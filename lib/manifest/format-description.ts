import type { Manifest, ManifestScope } from '@/lib/manifest/cache';

// Sprint 30 WP-30.1: fold the TRel relationship graph into the standard MCP
// `description` field. Standard clients (Claude Desktop, Cursor, Anthropic
// `mcp_servers` Beta) drop `_meta` and never call extension methods, so the
// graph stays invisible to the model unless we surface it through the one
// field every client forwards verbatim.
//
// Pure function, zero IO, zero mocks needed in tests.

export type FormatToolDescriptionEdge = {
  to: string;
  type: string;
  description: string;
};

export type FormatToolDescriptionRoute = {
  name: string;
  stepCount: number;
  hasFallback: boolean;
  hasRollback: boolean;
};

export type FormatToolDescriptionInput = {
  tool: { name: string; description: string };
  outgoingEdges: FormatToolDescriptionEdge[];
  parentRoutes: FormatToolDescriptionRoute[];
  scope: ManifestScope['kind'];
};

type ScopeCaps = {
  edges: number;
  routes: number;
};

const SCOPE_CAPS: Record<ManifestScope['kind'], ScopeCaps> = {
  org: { edges: 3, routes: 1 },
  domain: { edges: 5, routes: 2 },
  server: { edges: 8, routes: Number.POSITIVE_INFINITY },
};

// Per-tool description budget. ~300 tokens per tool, so a 50-tool org-
// scope manifest adds ~15k tokens to the `tools/list` response — under
// the model's context budget with headroom for the prompt + history.
// Empirically chosen: tighter caps drop high-signal saga edges; looser
// caps bloat the system prompt without proportional behavior gains.
const MAX_TOTAL_CHARS = 1200;
const TRUNCATION_SUFFIX = ' …';

// Edge-type render groups, in stable order. Anything not listed here is
// dropped silently (defensive: schema may add types ahead of this code).
const REQUIRES_BEFORE = 'requires_before';
const PRODUCES_INPUT_FOR = 'produces_input_for';
const COMPENSATED_BY = 'compensated_by';
const FALLBACK_TO = 'fallback_to';
const SUGGESTS_AFTER = 'suggests_after';
const ALTERNATIVE_TO = 'alternative_to';

const formatEdgeList = (
  edges: FormatToolDescriptionEdge[],
  prefix: string,
): string | null => {
  if (edges.length === 0) return null;
  const parts = edges.map((e) => `${e.to} (${e.description})`);
  return `${prefix} ${parts.join('; ')}.`;
};

const formatSafetyNet = (
  edges: FormatToolDescriptionEdge[],
  label: 'Rollback' | 'Fallback',
): string[] => {
  return edges.map((e) => `${label}: ${e.to} — ${e.description}.`);
};

const formatCombinedLine = (
  edges: FormatToolDescriptionEdge[],
  prefix: string,
): string | null => {
  if (edges.length === 0) return null;
  const parts = edges.map((e) => e.to);
  return `${prefix} ${parts.join(', ')}.`;
};

const formatRouteLine = (route: FormatToolDescriptionRoute): string => {
  const guards: string[] = [];
  if (route.hasRollback) guards.push('rollback');
  if (route.hasFallback) guards.push('fallback');
  const guardSuffix = guards.length > 0 ? ` with ${guards.join(' + ')}` : '';
  return `Part of route: ${route.name} (${route.stepCount} steps${guardSuffix}) — prefer execute_route('${route.name}') for the full workflow.`;
};

// Cap ordered edges per type before assembly: edges from the manifest are
// already a stable order (insertion order), we just slice to the budget.
const sliceByType = (
  edges: FormatToolDescriptionEdge[],
  cap: number,
): FormatToolDescriptionEdge[] => {
  if (cap === Number.POSITIVE_INFINITY) return edges;
  return edges.slice(0, cap);
};

const truncate = (s: string): string => {
  if (s.length <= MAX_TOTAL_CHARS) return s;
  const sliceLen = MAX_TOTAL_CHARS - TRUNCATION_SUFFIX.length;
  const safeLen = sliceLen > 0 ? sliceLen : 0;
  return `${s.slice(0, safeLen)}${TRUNCATION_SUFFIX}`;
};

export const formatToolDescription = (input: FormatToolDescriptionInput): string => {
  const { tool, outgoingEdges, parentRoutes, scope } = input;
  const original = tool.description ?? '';

  if (outgoingEdges.length === 0 && parentRoutes.length === 0) {
    return original;
  }

  const caps = SCOPE_CAPS[scope];

  // Group edges by type (stable insertion order within each group).
  const byType = new Map<string, FormatToolDescriptionEdge[]>();
  for (const edge of outgoingEdges) {
    const bucket = byType.get(edge.type);
    if (bucket) bucket.push(edge);
    else byType.set(edge.type, [edge]);
  }

  // Apply per-type caps so we don't blow the budget on one over-connected
  // edge type. Total edges still bounded by `caps.edges` after the global
  // slice below.
  const requiresBefore = sliceByType(byType.get(REQUIRES_BEFORE) ?? [], caps.edges);
  const producesInputFor = sliceByType(byType.get(PRODUCES_INPUT_FOR) ?? [], caps.edges);
  const compensatedBy = sliceByType(byType.get(COMPENSATED_BY) ?? [], caps.edges);
  const fallbackTo = sliceByType(byType.get(FALLBACK_TO) ?? [], caps.edges);
  const suggestsAfter = sliceByType(byType.get(SUGGESTS_AFTER) ?? [], caps.edges);
  const alternativeTo = sliceByType(byType.get(ALTERNATIVE_TO) ?? [], caps.edges);

  // Apply global edge cap by trimming render groups in priority order:
  // requires_before > produces_input_for > compensated_by > fallback_to >
  // suggests_after > alternative_to. The earlier groups carry more workflow
  // signal so they keep their slots.
  const renderOrder: FormatToolDescriptionEdge[][] = [
    requiresBefore,
    producesInputFor,
    compensatedBy,
    fallbackTo,
    suggestsAfter,
    alternativeTo,
  ];
  let remaining = caps.edges;
  for (const group of renderOrder) {
    if (remaining <= 0) {
      group.length = 0;
      continue;
    }
    if (group.length > remaining) group.length = remaining;
    remaining -= group.length;
  }

  const lines: string[] = [];

  const beforeLine = formatEdgeList(requiresBefore, 'Before this tool, ensure:');
  if (beforeLine) lines.push(beforeLine);

  const afterLine = formatEdgeList(producesInputFor, 'After this tool, typically call:');
  if (afterLine) lines.push(afterLine);

  for (const safetyLine of formatSafetyNet(compensatedBy, 'Rollback')) lines.push(safetyLine);
  for (const safetyLine of formatSafetyNet(fallbackTo, 'Fallback')) lines.push(safetyLine);

  const suggestsLine = formatCombinedLine(suggestsAfter, 'Often paired with:');
  if (suggestsLine) lines.push(suggestsLine);

  const alternativeLine = formatCombinedLine(alternativeTo, 'Alternatives:');
  if (alternativeLine) lines.push(alternativeLine);

  // Route membership: capped per scope. Render in input order so callers
  // control prominence by seeding the array.
  const routesCap = caps.routes === Number.POSITIVE_INFINITY ? parentRoutes.length : caps.routes;
  const cappedRoutes = parentRoutes.slice(0, routesCap);
  for (const route of cappedRoutes) lines.push(formatRouteLine(route));

  if (lines.length === 0) return original;

  const enriched = original
    ? `${original}\n\n— Workflow context —\n${lines.join('\n')}`
    : `— Workflow context —\n${lines.join('\n')}`;

  return truncate(enriched);
};

// Pre-computes a tool_id -> parent-route descriptors map for the entire
// manifest. Caller (stateless-server tools/list builder) uses it for O(1)
// lookups while assembling each tool's enriched description.
export const buildRoutesByToolId = (
  manifest: Manifest,
): Map<string, FormatToolDescriptionRoute[]> => {
  const out = new Map<string, FormatToolDescriptionRoute[]>();
  for (const route of manifest.routes) {
    const steps = manifest.route_steps.filter((s) => s.route_id === route.id);
    const descriptor: FormatToolDescriptionRoute = {
      name: route.name,
      stepCount: steps.length,
      hasFallback: steps.some((s) => s.fallback_route_id !== null),
      hasRollback: steps.some((s) => s.rollback_tool_id !== null),
    };
    const seen = new Set<string>();
    for (const step of steps) {
      if (seen.has(step.tool_id)) continue;
      seen.add(step.tool_id);
      const bucket = out.get(step.tool_id);
      if (bucket) bucket.push(descriptor);
      else out.set(step.tool_id, [descriptor]);
    }
  }
  return out;
};
