import { logMCPEvent, redactPayload } from '@/lib/audit/logger';
import type { Manifest, RelationshipRow, RouteStepRow, ToolRow } from '@/lib/manifest/cache';
import { buildCatalog, executeTool } from '@/lib/mcp/tool-dispatcher';
import type {
  ExecuteRouteRollback,
  ExecuteRouteRollbackSummary,
  ExecuteRouteStep,
} from '@/lib/mcp/trel-schemas';
import type { CapturedStep, ExecuteRouteCtx } from '@/lib/mcp/route-utils';
import { resolveInputMapping, findCatalogEntry } from '@/lib/mcp/route-utils';

// Pick the first outgoing compensated_by edge, deterministic by edge id. Same
// shape as pickFallbackEdge — unreachable to_tool_id returns undefined so a
// mis-wired compensation is surfaced as "no_compensation_available" rather
// than crashing rollback.
const pickCompensationEdge = (
  toolId: string,
  manifest: Manifest,
): { edge: RelationshipRow; tool: ToolRow } | undefined => {
  const edges = manifest.relationships
    .filter((r) => r.from_tool_id === toolId && r.relationship_type === 'compensated_by')
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const edge of edges) {
    const tool = manifest.tools.find((t) => t.id === edge.to_tool_id);
    if (tool) return { edge, tool };
  }
  return undefined;
};

// Walk the completed steps in reverse and fire each step's compensated_by
// tool. Compensator args come from `step.rollback_input_mapping` when set
// (canonical saga pattern — producer result shape rarely matches compensator
// schema), falling back to the producing step's result verbatim for legacy
// routes without a mapping. Best-effort: a compensation that throws or
// returns !ok is logged + marked compensation_failed, but the walk continues
// to the next older step. Mutates each step entry in place to annotate
// `rollback`, and returns the aggregate summary.
export const executeRollback = async (
  steps: ExecuteRouteStep[],
  plan: Array<{ step: RouteStepRow; tool: ToolRow }>,
  manifest: Manifest,
  inputs: Record<string, unknown>,
  captureBag: Record<string, CapturedStep>,
  ctx: ExecuteRouteCtx,
): Promise<ExecuteRouteRollbackSummary> => {
  const catalog = buildCatalog(manifest);
  const summary: ExecuteRouteRollbackSummary = {
    attempted: true,
    compensated_count: 0,
    skipped_count: 0,
    failed_count: 0,
  };

  // The final step entry is the failing one — it never completed, so skip it.
  // Walk from the second-last step backwards to step 0.
  for (let i = steps.length - 2; i >= 0; i -= 1) {
    const stepEntry = steps[i];
    const planPair = plan.find((p) => p.step.step_order === stepEntry?.step_order);
    if (!stepEntry || !planPair) continue;

    // Sprint 22 WP-22.4 follow-on: when this step succeeded via its
    // fallback path, the captured result + compensator semantics belong to
    // the fallback target tool, not the primary. Pick the compensator edge
    // from whichever tool actually ran, and prefer the step's
    // fallback_rollback_input_mapping over rollback_input_mapping.
    const fallbackUsed = stepEntry.fallback_used;
    const effectiveToolId = fallbackUsed
      ? fallbackUsed.fallback_tool_id
      : planPair.tool.id;

    const compensation = pickCompensationEdge(effectiveToolId, manifest);
    if (!compensation) {
      const rollback: ExecuteRouteRollback = {
        attempted: false,
        status: 'no_compensation_available',
      };
      stepEntry.rollback = rollback;
      summary.skipped_count += 1;
      continue;
    }

    const compEntry = findCatalogEntry(catalog, compensation.tool);
    if (!compEntry) {
      const rollback: ExecuteRouteRollback = {
        attempted: false,
        status: 'no_compensation_available',
      };
      stepEntry.rollback = rollback;
      summary.skipped_count += 1;
      continue;
    }

    // Build compensation args. Preference order:
    //   1. fallback_rollback_input_mapping if fallback_used and set
    //   2. rollback_input_mapping (canonical saga path) on the step
    //   3. producer's result verbatim (legacy)
    const activeMapping =
      fallbackUsed &&
      planPair.step.fallback_rollback_input_mapping &&
      Object.keys(planPair.step.fallback_rollback_input_mapping).length > 0
        ? planPair.step.fallback_rollback_input_mapping
        : planPair.step.rollback_input_mapping &&
            Object.keys(planPair.step.rollback_input_mapping).length > 0
          ? planPair.step.rollback_input_mapping
          : null;

    let compArgs: Record<string, unknown>;
    try {
      if (activeMapping) {
        compArgs = resolveInputMapping(activeMapping, inputs, captureBag);
      } else {
        const originalResult = stepEntry.result;
        compArgs =
          originalResult && typeof originalResult === 'object' && !Array.isArray(originalResult)
            ? (originalResult as Record<string, unknown>)
            : { value: originalResult };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stepEntry.rollback = {
        attempted: true,
        status: 'compensation_failed',
        compensation_tool_name: compensation.tool.name,
        error: `rollback_input_mapping: ${message}`,
      };
      summary.failed_count += 1;
      continue;
    }

    try {
      const exec = await executeTool(manifest, compEntry, compArgs, { traceId: ctx.traceId });
      if (exec.ok) {
        stepEntry.rollback = {
          attempted: true,
          status: 'ok',
          compensation_tool_name: compensation.tool.name,
        };
        summary.compensated_count += 1;
        logMCPEvent({
          trace_id: ctx.traceId,
          organization_id: ctx.organizationId,
          server_id: compensation.tool.server_id,
          tool_name: compensation.tool.name,
          method: 'execute_route.rollback',
          status: 'rollback_executed',
          payload: {
            original_tool: planPair.tool.name,
            compensation_tool: compensation.tool.name,
            original_step_order: stepEntry.step_order,
            result: redactPayload(exec.result),
          },
        });
        continue;
      }
      stepEntry.rollback = {
        attempted: true,
        status: 'compensation_failed',
        compensation_tool_name: compensation.tool.name,
        error: exec.error,
      };
      summary.failed_count += 1;
      logMCPEvent({
        trace_id: ctx.traceId,
        organization_id: ctx.organizationId,
        server_id: compensation.tool.server_id,
        tool_name: compensation.tool.name,
        method: 'execute_route.rollback',
        status: 'rollback_executed',
        payload: {
          original_tool: planPair.tool.name,
          compensation_tool: compensation.tool.name,
          original_step_order: stepEntry.step_order,
          error: exec.error,
          args_sent: redactPayload(compArgs),
          mapping_used: activeMapping,
          fallback_aware: Boolean(fallbackUsed),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stepEntry.rollback = {
        attempted: true,
        status: 'compensation_failed',
        compensation_tool_name: compensation.tool.name,
        error: message,
      };
      summary.failed_count += 1;
      logMCPEvent({
        trace_id: ctx.traceId,
        organization_id: ctx.organizationId,
        server_id: compensation.tool.server_id,
        tool_name: compensation.tool.name,
        method: 'execute_route.rollback',
        status: 'rollback_executed',
        payload: {
          original_tool: planPair.tool.name,
          compensation_tool: compensation.tool.name,
          original_step_order: stepEntry.step_order,
          error: message,
        },
      });
    }
  }

  return summary;
};
