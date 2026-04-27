// Synthetic `execute_route` tool that lets standard MCP clients invoke saga
// orchestration through the same `tools/call` surface they use for any other
// tool. Without this shim, agents see "prefer execute_route('sales_escalation')"
// in our enriched descriptions but cannot act on it: clients like Claude Code,
// Cursor, and Anthropic's `mcp_servers` connector only call what is in
// `tools/list`. The native `ExecuteRouteRequestSchema` JSON-RPC method stays
// for backward compat with custom orchestrators.
//
// Wire shape on `tools/list`:
//   {
//     name: 'execute_route',
//     description: '<lists available routes + saga semantics>',
//     inputSchema: { route_name? OR route_id?, inputs }
//   }
//
// Wire shape on `tools/call`:
//   { name: 'execute_route', arguments: { route_name: 'foo', inputs: {...} } }
// resolves the name → route_id, dispatches to `executeRoute()`.

import type { RouteRow, RouteStepRow, RelationshipRow } from '@/lib/manifest/cache';

export const EXECUTE_ROUTE_TOOL_NAME = 'execute_route';

type RouteSummary = {
  name: string;
  step_count: number;
  has_fallback: boolean;
  has_rollback: boolean;
  description: string | null;
};

const summarizeRoute = (
  route: RouteRow,
  steps: RouteStepRow[],
  relationships: RelationshipRow[],
): RouteSummary => {
  const routeSteps = steps.filter((s) => s.route_id === route.id);
  const stepToolIds = new Set(routeSteps.map((s) => s.tool_id));
  const hasFallback = relationships.some(
    (r) => r.relationship_type === 'fallback_to' && stepToolIds.has(r.from_tool_id),
  );
  const hasRollback = relationships.some(
    (r) => r.relationship_type === 'compensated_by' && stepToolIds.has(r.from_tool_id),
  );
  return {
    name: route.name,
    step_count: routeSteps.length,
    has_fallback: hasFallback,
    has_rollback: hasRollback,
    description: route.description,
  };
};

const formatRouteLine = (s: RouteSummary): string => {
  const guards: string[] = [];
  if (s.has_rollback) guards.push('rollback');
  if (s.has_fallback) guards.push('fallback');
  const guardSuffix = guards.length > 0 ? ` with ${guards.join(' + ')}` : '';
  const descSuffix = s.description ? `: ${s.description}` : '';
  return `• ${s.name} (${s.step_count} steps${guardSuffix})${descSuffix}`;
};

// Build the synthetic tool descriptor surfaced on `tools/list`. Returns null
// when the manifest has no routes — no point exposing a tool that cannot do
// anything. Caller must check this and skip emission accordingly.
export const buildExecuteRouteToolDescriptor = (
  routes: RouteRow[],
  steps: RouteStepRow[],
  relationships: RelationshipRow[],
): { name: string; description: string; inputSchema: Record<string, unknown> } | null => {
  if (routes.length === 0) return null;
  const summaries = routes.map((r) => summarizeRoute(r, steps, relationships));
  const routeLines = summaries.map(formatRouteLine).join('\n');
  const description = [
    'Execute a multi-step saga orchestrated by Semantic GPS. Pass `route_name` (or `route_id`) and the literal `inputs` for the first step; later steps pull from a per-run capture bag.',
    '',
    'Saga semantics: if any step halts, downstream steps with `compensated_by` edges roll back automatically; steps with `fallback_to` edges retry against the fallback tool when the primary is unavailable. Audit, policy, and rollback machinery wraps every step.',
    '',
    'Available routes:',
    routeLines,
    '',
    "Example: { route_name: '" + summaries[0].name + "', inputs: { /* first-step args */ } }",
  ].join('\n');

  const inputSchema: Record<string, unknown> = {
    type: 'object',
    required: ['inputs'],
    properties: {
      route_name: {
        type: 'string',
        description:
          'Route name as listed above. Either `route_name` or `route_id` must be set; `route_name` wins when both are present.',
      },
      route_id: {
        type: 'string',
        description: 'Route UUID. Use `route_name` instead when you have it.',
      },
      inputs: {
        type: 'object',
        description:
          'Literal inputs bound into the first step of the saga. Later steps pull from the per-run capture bag via the `$inputs` / `$steps` DSL.',
      },
    },
    additionalProperties: false,
  };

  return {
    name: EXECUTE_ROUTE_TOOL_NAME,
    description,
    inputSchema,
  };
};

export type ResolvedExecuteRouteParams =
  | { ok: true; route_id: string; inputs: Record<string, unknown> }
  | { ok: false; error: string };

// Resolve raw `tools/call` args into the `{ route_id, inputs }` shape that
// `executeRoute()` expects. Accepts either a `route_name` (resolved against
// the manifest's routes) or a `route_id` UUID. Returns a structured error
// instead of throwing so the caller can surface it as a tool-result error.
export const resolveExecuteRouteParams = (
  args: Record<string, unknown>,
  routes: RouteRow[],
): ResolvedExecuteRouteParams => {
  const rawInputs = args.inputs;
  const inputs =
    rawInputs && typeof rawInputs === 'object' && !Array.isArray(rawInputs)
      ? (rawInputs as Record<string, unknown>)
      : {};

  const routeName = typeof args.route_name === 'string' ? args.route_name.trim() : '';
  const routeId = typeof args.route_id === 'string' ? args.route_id.trim() : '';

  if (routeName.length > 0) {
    const match = routes.find((r) => r.name === routeName);
    if (!match) {
      const known = routes.map((r) => r.name).join(', ') || '(none)';
      return {
        ok: false,
        error: `route '${routeName}' not found. Known routes: ${known}.`,
      };
    }
    return { ok: true, route_id: match.id, inputs };
  }

  if (routeId.length > 0) {
    const match = routes.find((r) => r.id === routeId);
    if (!match) {
      return { ok: false, error: `route_id '${routeId}' not in this scope's manifest.` };
    }
    return { ok: true, route_id: match.id, inputs };
  }

  return { ok: false, error: 'either route_name or route_id must be provided.' };
};
