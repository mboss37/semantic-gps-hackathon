import { logMCPEvent, redactPayload } from '@/lib/audit/logger';
import type { Manifest, RelationshipRow, RouteStepRow, ToolRow } from '@/lib/manifest/cache';
import { buildCatalog, executeTool, type ToolCatalogEntry } from '@/lib/mcp/tool-dispatcher';
import type {
  ExecuteRouteParams,
  ExecuteRouteResult,
  ExecuteRouteRollback,
  ExecuteRouteRollbackSummary,
  ExecuteRouteStep,
  ExecuteRouteStepStatus,
} from '@/lib/mcp/trel-schemas';
import {
  runPostCallPolicies,
  runPreCallPolicies,
  type PreCallContext,
} from '@/lib/policies/enforce';

// Multi-step orchestrator. Given a route_id + caller inputs, it sorts the
// route_steps by step_order, resolves each step's input_mapping against a
// rolling capture-bag, and threads every call through the same pre/post
// policy stack + real proxies as a plain tools/call. Halts on first error
// with halted_at_step — fallback/rollback are Sprint 7 concerns.

export type PolicyContextBuilder = (
  entry: ToolCatalogEntry,
  args: Record<string, unknown>,
) => PreCallContext;

export type ExecuteRouteCtx = {
  traceId: string;
};

// input_mapping DSL prefixes. Only values matching these prefixes at the head
// are resolved; everything else (including embedded `$inputs.foo` mid-string)
// passes through as a literal.
const STEPS_PREFIX = '$steps.';
const INPUTS_PREFIX = '$inputs.';

// A captured step carries both the args that were sent to the tool AND the
// post-redaction result. Rollback/fallback can reference either — "undo this
// create_issue" needs {owner, repo} from the original args plus the issue
// `number` from the result.
export type CapturedStep = {
  args: Record<string, unknown>;
  result: unknown;
};

// Resolve a "$steps.<capture_key>.<dot.path>" reference against the capture
// bag. Each captured step is `{args, result}`. When the path's next segment
// after the capture key is `args` or `result` we navigate that explicit
// subtree; any other segment auto-prefixes to `.result.` for backwards
// compatibility with routes written before Sprint 10's rollback mapping.
// Supports dot segments + numeric array indices — no wildcards, no slices.
// Missing paths throw so misconfigured routes fail loud instead of silently
// feeding `undefined` into the next tool.
const resolveStepRef = (
  path: string,
  captureBag: Record<string, CapturedStep>,
): unknown => {
  const segments = path.slice(STEPS_PREFIX.length).split('.');
  const captureKey = segments[0];
  if (captureKey === undefined || captureKey === '') {
    throw new Error(`empty segment in "${path}"`);
  }
  const rest = segments.slice(1);
  const captured = captureBag[captureKey];
  if (captured === undefined) {
    throw new Error(`"${path}" references unknown capture key "${captureKey}"`);
  }

  // Explicit namespace or backwards-compat implicit result.
  let cursor: unknown;
  let pathSegments: string[];
  if (rest[0] === 'args') {
    cursor = captured.args;
    pathSegments = rest.slice(1);
  } else if (rest[0] === 'result') {
    cursor = captured.result;
    pathSegments = rest.slice(1);
  } else {
    cursor = captured.result;
    pathSegments = rest;
  }

  for (const seg of pathSegments) {
    if (seg === '') {
      throw new Error(`empty segment in "${path}"`);
    }
    if (cursor === null || cursor === undefined) {
      throw new Error(`"${path}" traversal hit null/undefined at segment "${seg}"`);
    }
    if (Array.isArray(cursor) && /^\d+$/.test(seg)) {
      cursor = cursor[Number(seg)];
      continue;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[seg];
      continue;
    }
    throw new Error(`"${path}" traversal reached a primitive at segment "${seg}"`);
  }
  return cursor;
};

const resolveInputMapping = (
  mapping: Record<string, unknown>,
  inputs: Record<string, unknown>,
  captureBag: Record<string, CapturedStep>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(mapping)) {
    if (typeof raw !== 'string') {
      out[key] = raw;
      continue;
    }
    if (raw.startsWith(STEPS_PREFIX)) {
      out[key] = resolveStepRef(raw, captureBag);
      continue;
    }
    if (raw.startsWith(INPUTS_PREFIX)) {
      out[key] = inputs[raw.slice(INPUTS_PREFIX.length)];
      continue;
    }
    out[key] = raw;
  }
  return out;
};

const findCatalogEntry = (
  catalog: ToolCatalogEntry[],
  tool: ToolRow,
): ToolCatalogEntry | undefined =>
  catalog.find((c) => c.tool_id === tool.id && c.source === 'manifest');

const terminalError = (routeId: string, rationale: string): ExecuteRouteResult => ({
  ok: false,
  route_id: routeId,
  steps: [],
  rationale,
});

// Build an execution plan up-front so we fail-fast on missing rows rather
// than mid-route. Returns either the sorted-steps-with-tools pairs or a
// terminal error result.
const buildPlan = (
  routeId: string,
  manifest: Manifest,
): { steps: Array<{ step: RouteStepRow; tool: ToolRow }> } | { error: ExecuteRouteResult } => {
  const route = manifest.routes.find((r) => r.id === routeId);
  if (!route) {
    return { error: terminalError(routeId, `route ${routeId} not found in scope`) };
  }
  const steps = manifest.route_steps
    .filter((s) => s.route_id === routeId)
    .slice()
    .sort((a, b) => a.step_order - b.step_order);
  if (steps.length === 0) {
    return { error: terminalError(routeId, `route ${routeId} has no steps`) };
  }
  const pairs: Array<{ step: RouteStepRow; tool: ToolRow }> = [];
  for (const step of steps) {
    const tool = manifest.tools.find((t) => t.id === step.tool_id);
    if (!tool) {
      return {
        error: terminalError(
          routeId,
          `route ${routeId} step ${step.step_order} references missing tool ${step.tool_id}`,
        ),
      };
    }
    pairs.push({ step, tool });
  }
  return { steps: pairs };
};

// ---------------------------------------------------------------------------
// Per-step helpers. Each one emits its own audit log and returns the
// ExecuteRouteStep shape so `runSingleStep` can stay a thin dispatcher.

const emitInputMappingError = (
  step: RouteStepRow,
  tool: ToolRow,
  started: number,
  error: unknown,
  traceId: string,
): ExecuteRouteStep => {
  const message = error instanceof Error ? error.message : String(error);
  const latencyMs = Math.round(performance.now() - started);
  const errText = `input_mapping: ${message}`;
  logMCPEvent({
    trace_id: traceId,
    server_id: tool.server_id,
    tool_name: tool.name,
    method: 'execute_route.step',
    status: 'origin_error',
    latency_ms: latencyMs,
    payload: { step_order: step.step_order, reason: errText },
  });
  return {
    step_order: step.step_order,
    tool_name: tool.name,
    status: 'origin_error',
    latency_ms: latencyMs,
    error: errText,
  };
};

const emitBlockedStep = (
  step: RouteStepRow,
  tool: ToolRow,
  args: Record<string, unknown>,
  started: number,
  pre: ReturnType<typeof runPreCallPolicies>,
  traceId: string,
): ExecuteRouteStep => {
  const latencyMs = Math.round(performance.now() - started);
  const reason = pre.action === 'block' ? pre.reason : 'blocked_by_policy';
  logMCPEvent({
    trace_id: traceId,
    server_id: tool.server_id,
    tool_name: tool.name,
    method: 'execute_route.step',
    status: 'blocked_by_policy',
    policy_decisions: pre.decisions,
    latency_ms: latencyMs,
    payload: { step_order: step.step_order, args: redactPayload(args), reason },
  });
  return {
    step_order: step.step_order,
    tool_name: tool.name,
    status: 'blocked_by_policy',
    latency_ms: latencyMs,
    error: reason,
  };
};

const emitExecStep = (
  step: RouteStepRow,
  tool: ToolRow,
  args: Record<string, unknown>,
  exec: Awaited<ReturnType<typeof executeTool>>,
  post: ReturnType<typeof runPostCallPolicies>,
  pre: ReturnType<typeof runPreCallPolicies>,
  started: number,
  traceId: string,
): ExecuteRouteStep => {
  const latencyMs = exec.upstreamLatencyMs ?? Math.round(performance.now() - started);
  const status: ExecuteRouteStepStatus = exec.ok ? 'ok' : 'origin_error';
  logMCPEvent({
    trace_id: traceId,
    server_id: tool.server_id,
    tool_name: tool.name,
    method: 'execute_route.step',
    status,
    policy_decisions: [...pre.decisions, ...post.decisions],
    latency_ms: latencyMs,
    payload: {
      step_order: step.step_order,
      args: redactPayload(args),
      result: redactPayload(post.result),
    },
  });
  if (!exec.ok) {
    return {
      step_order: step.step_order,
      tool_name: tool.name,
      status: 'origin_error',
      latency_ms: latencyMs,
      error: exec.error,
    };
  }
  return {
    step_order: step.step_order,
    tool_name: tool.name,
    status: 'ok',
    latency_ms: latencyMs,
    result: post.result,
  };
};

// Pick the first outgoing fallback_to edge for a tool, sorted by relationship
// id for determinism. Returns undefined if no edge exists, or if the referenced
// to_tool_id isn't present in the scoped manifest (unreachable fallback).
const pickFallbackEdge = (
  toolId: string,
  manifest: Manifest,
): { edge: RelationshipRow; tool: ToolRow } | undefined => {
  const edges = manifest.relationships
    .filter((r) => r.from_tool_id === toolId && r.relationship_type === 'fallback_to')
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const edge of edges) {
    const tool = manifest.tools.find((t) => t.id === edge.to_tool_id);
    if (tool) return { edge, tool };
  }
  return undefined;
};

// Execute primary + post-policies and return both the step shape and the raw
// exec/post outputs. Split out so the fallback path can reuse it against the
// fallback tool without re-resolving input_mapping or re-running pre-policies.
const runExecPhase = async (
  step: RouteStepRow,
  tool: ToolRow,
  entry: ToolCatalogEntry,
  args: Record<string, unknown>,
  policyCtx: PreCallContext,
  pre: ReturnType<typeof runPreCallPolicies>,
  manifest: Manifest,
  started: number,
  traceId: string,
): Promise<{
  stepResult: ExecuteRouteStep;
  postResult: unknown;
  exec: Awaited<ReturnType<typeof executeTool>>;
}> => {
  const exec = await executeTool(manifest, entry, args, { traceId });
  const post = runPostCallPolicies({ ...policyCtx, result: exec.result }, manifest);
  const stepResult = emitExecStep(step, tool, args, exec, post, pre, started, traceId);
  return { stepResult, postResult: post.result, exec };
};

// Handles the fallback_to dance when the primary tool errors. Emits the
// fallback_triggered audit events and returns the final step shape —
// either a rewritten ok step with fallback_used, or the original origin_error
// step annotated with fallback_also_failed=true.
const attemptFallback = async (
  primaryStep: ExecuteRouteStep,
  pair: { step: RouteStepRow; tool: ToolRow },
  manifest: Manifest,
  args: Record<string, unknown>,
  policyCtxBuilder: PolicyContextBuilder,
  ctx: ExecuteRouteCtx,
  captureBag: Record<string, CapturedStep>,
): Promise<ExecuteRouteStep> => {
  const { step, tool: primaryTool } = pair;
  const originalError = primaryStep.error ?? 'origin_error';

  const fallback = pickFallbackEdge(primaryTool.id, manifest);
  if (!fallback) return primaryStep;

  // Resolve the fallback tool against the catalog; if unreachable, keep the
  // primary error shape — a mis-wired relationship shouldn't silently rewrite
  // history.
  const catalog = buildCatalog(manifest);
  const fallbackEntry = findCatalogEntry(catalog, fallback.tool);
  if (!fallbackEntry) return primaryStep;

  // Re-run pre-policies against the fallback tool identity so allowlist /
  // injection-guard decisions reflect the new target. Input args are reused
  // verbatim — the contract assumes schema compatibility.
  const fallbackPolicyCtx = policyCtxBuilder(fallbackEntry, args);
  const fallbackPre = runPreCallPolicies(fallbackPolicyCtx, manifest);
  const fallbackStarted = performance.now();
  if (fallbackPre.action === 'block') {
    const blocked = emitBlockedStep(step, fallback.tool, args, fallbackStarted, fallbackPre, ctx.traceId);
    logMCPEvent({
      trace_id: ctx.traceId,
      server_id: primaryTool.server_id,
      tool_name: primaryTool.name,
      method: 'execute_route.fallback',
      status: 'fallback_triggered',
      latency_ms: blocked.latency_ms,
      payload: {
        step_order: step.step_order,
        original_tool_id: primaryTool.id,
        fallback_tool_id: fallback.tool.id,
        original_error: originalError,
        fallback_error: blocked.error ?? 'blocked_by_policy',
      },
    });
    return {
      ...primaryStep,
      fallback_also_failed: true,
      error: `${originalError} (fallback ${fallback.tool.name} blocked: ${blocked.error ?? 'blocked_by_policy'})`,
    };
  }

  const { stepResult: fallbackStep, postResult: fallbackPostResult } = await runExecPhase(
    step,
    fallback.tool,
    fallbackEntry,
    args,
    fallbackPolicyCtx,
    fallbackPre,
    manifest,
    fallbackStarted,
    ctx.traceId,
  );

  if (fallbackStep.status === 'ok') {
    logMCPEvent({
      trace_id: ctx.traceId,
      server_id: primaryTool.server_id,
      tool_name: primaryTool.name,
      method: 'execute_route.fallback',
      status: 'fallback_triggered',
      latency_ms: fallbackStep.latency_ms,
      payload: {
        step_order: step.step_order,
        original_tool_id: primaryTool.id,
        fallback_tool_id: fallback.tool.id,
        original_error: originalError,
      },
    });
    if (step.output_capture_key) {
      captureBag[step.output_capture_key] = { args, result: fallbackPostResult };
    }
    return {
      step_order: step.step_order,
      tool_name: primaryTool.name,
      status: 'ok',
      latency_ms: fallbackStep.latency_ms,
      result: fallbackStep.result,
      fallback_used: {
        original_tool_name: primaryTool.name,
        fallback_tool_name: fallback.tool.name,
        original_error: originalError,
      },
    };
  }

  logMCPEvent({
    trace_id: ctx.traceId,
    server_id: primaryTool.server_id,
    tool_name: primaryTool.name,
    method: 'execute_route.fallback',
    status: 'fallback_triggered',
    latency_ms: fallbackStep.latency_ms,
    payload: {
      step_order: step.step_order,
      original_tool_id: primaryTool.id,
      fallback_tool_id: fallback.tool.id,
      original_error: originalError,
      fallback_error: fallbackStep.error ?? 'origin_error',
    },
  });
  return {
    ...primaryStep,
    fallback_also_failed: true,
    error: `${originalError} (fallback ${fallback.tool.name} failed: ${fallbackStep.error ?? 'origin_error'})`,
  };
};

const runSingleStep = async (
  pair: { step: RouteStepRow; tool: ToolRow },
  entry: ToolCatalogEntry,
  manifest: Manifest,
  inputs: Record<string, unknown>,
  captureBag: Record<string, CapturedStep>,
  policyCtxBuilder: PolicyContextBuilder,
  ctx: ExecuteRouteCtx,
): Promise<ExecuteRouteStep> => {
  const started = performance.now();
  const { step, tool } = pair;

  let args: Record<string, unknown>;
  try {
    args = resolveInputMapping(
      (step.input_mapping ?? {}) as Record<string, unknown>,
      inputs,
      captureBag,
    );
  } catch (err) {
    return emitInputMappingError(step, tool, started, err, ctx.traceId);
  }

  const policyCtx = policyCtxBuilder(entry, args);
  const pre = runPreCallPolicies(policyCtx, manifest);
  if (pre.action === 'block') {
    return emitBlockedStep(step, tool, args, started, pre, ctx.traceId);
  }

  const { stepResult, postResult } = await runExecPhase(
    step,
    tool,
    entry,
    args,
    policyCtx,
    pre,
    manifest,
    started,
    ctx.traceId,
  );

  if (stepResult.status === 'ok') {
    if (step.output_capture_key) {
      captureBag[step.output_capture_key] = { args, result: postResult };
    }
    return stepResult;
  }

  // Only origin_error triggers fallback — policy blocks and unauthorized are
  // governance decisions, not reachability failures.
  if (stepResult.status !== 'origin_error') return stepResult;

  return attemptFallback(
    stepResult,
    pair,
    manifest,
    args,
    policyCtxBuilder,
    ctx,
    captureBag,
  );
};

// Resolve a plan pair to a catalog entry. Returns either the entry or a
// terminal step-result + rationale describing the miss.
const resolveEntry = (
  pair: { step: RouteStepRow; tool: ToolRow },
  catalog: ToolCatalogEntry[],
): { entry: ToolCatalogEntry } | { terminalStep: ExecuteRouteStep; rationale: string } => {
  const entry = findCatalogEntry(catalog, pair.tool);
  if (entry) return { entry };
  return {
    terminalStep: {
      step_order: pair.step.step_order,
      tool_name: pair.tool.name,
      status: 'origin_error',
      latency_ms: 0,
      error: `catalog entry missing for tool ${pair.tool.name}`,
    },
    rationale: `Halted at step ${pair.step.step_order}: catalog entry missing for tool ${pair.tool.name}.`,
  };
};

const haltedResult = (
  routeId: string,
  steps: ExecuteRouteStep[],
  last: ExecuteRouteStep,
): ExecuteRouteResult => ({
  ok: false,
  route_id: routeId,
  steps,
  halted_at_step: last.step_order,
  rationale: `Halted at step ${last.step_order} (${last.tool_name}): ${last.status}${
    last.error ? ` — ${last.error}` : ''
  }.`,
});

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
const executeRollback = async (
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

    const compensation = pickCompensationEdge(planPair.tool.id, manifest);
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

    // Build compensation args. Preferred path: explicit rollback_input_mapping
    // on the step, resolved against the capture bag + route inputs. Fallback:
    // pass the producer's result verbatim (legacy behaviour; rarely works
    // when producer + compensator field names differ).
    let compArgs: Record<string, unknown>;
    try {
      if (
        planPair.step.rollback_input_mapping &&
        Object.keys(planPair.step.rollback_input_mapping).length > 0
      ) {
        compArgs = resolveInputMapping(
          planPair.step.rollback_input_mapping,
          inputs,
          captureBag,
        );
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
          mapping_used: planPair.step.rollback_input_mapping ?? null,
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

export type ExecuteRouteOptions = {
  autoRollbackOnHalt?: boolean;
};

export const executeRoute = async (
  params: ExecuteRouteParams,
  manifest: Manifest,
  policyCtxBuilder: PolicyContextBuilder,
  ctx: ExecuteRouteCtx,
  options: ExecuteRouteOptions = {},
): Promise<ExecuteRouteResult> => {
  const autoRollbackOnHalt = options.autoRollbackOnHalt ?? true;

  const plan = buildPlan(params.route_id, manifest);
  if ('error' in plan) return plan.error;

  const catalog = buildCatalog(manifest);
  const captureBag: Record<string, CapturedStep> = {};
  const steps: ExecuteRouteStep[] = [];

  for (const pair of plan.steps) {
    const resolved = resolveEntry(pair, catalog);
    if ('terminalStep' in resolved) {
      steps.push(resolved.terminalStep);
      const halted = {
        ...haltedResult(params.route_id, steps, resolved.terminalStep),
        rationale: resolved.rationale,
      };
      if (autoRollbackOnHalt && steps.length > 1) {
        halted.rollback_summary = await executeRollback(steps, plan.steps, manifest, params.inputs, captureBag, ctx);
      }
      return halted;
    }

    const stepResult = await runSingleStep(
      pair,
      resolved.entry,
      manifest,
      params.inputs,
      captureBag,
      policyCtxBuilder,
      ctx,
    );
    steps.push(stepResult);
    if (stepResult.status !== 'ok') {
      const halted = haltedResult(params.route_id, steps, stepResult);
      if (autoRollbackOnHalt && steps.length > 1) {
        halted.rollback_summary = await executeRollback(steps, plan.steps, manifest, params.inputs, captureBag, ctx);
      }
      return halted;
    }
  }

  return {
    ok: true,
    route_id: params.route_id,
    steps,
    rationale: `Completed ${steps.length} step(s) in order.`,
  };
};
