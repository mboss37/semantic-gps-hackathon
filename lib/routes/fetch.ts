// Read-only Route access for the dashboard. Routes + route_steps are joined to
// tools + routes in two-stage fetches (tools by id, fallback routes by id)
// instead of PostgREST inline joins, route_steps has two FKs to `tools`
// (`tool_id` + `rollback_tool_id`) and PostgREST ambiguity is noisier than
// two extra `.in(...)` calls.
//
// Sprint 28 redesign extends the lookup to carry server_id + server_name on
// each step so the timeline UI can render the same monogram chip used on
// /relationships, plus a 24h run-stats helper for the list page.

import type { SupabaseClient } from '@supabase/supabase-js';

export type RouteStepDetail = {
  id: string;
  step_order: number;
  tool_id: string;
  tool_name: string;
  tool_display_name: string | null;
  tool_server_id: string | null;
  tool_server_name: string | null;
  input_mapping: Record<string, unknown>;
  rollback_input_mapping: Record<string, unknown> | null;
  fallback_input_mapping: Record<string, unknown> | null;
  fallback_rollback_input_mapping: Record<string, unknown> | null;
  output_capture_key: string | null;
  fallback_route_id: string | null;
  fallback_route_name: string | null;
  rollback_tool_id: string | null;
  rollback_tool_name: string | null;
  rollback_tool_server_id: string | null;
  rollback_tool_server_name: string | null;
};

export type RouteListItem = {
  id: string;
  name: string;
  description: string | null;
  step_count: number;
  stats_24h: {
    runs: number;
    ok: number;
    errors: number;
  };
};

export type RouteDetail = {
  id: string;
  name: string;
  description: string | null;
  domain_id: string | null;
  steps: RouteStepDetail[];
};

type RouteRow = {
  id: string;
  organization_id: string;
  domain_id: string | null;
  name: string;
  description: string | null;
};

type StepRow = {
  id: string;
  route_id: string;
  step_order: number;
  tool_id: string;
  input_mapping: Record<string, unknown>;
  rollback_input_mapping: Record<string, unknown> | null;
  fallback_input_mapping: Record<string, unknown> | null;
  fallback_rollback_input_mapping: Record<string, unknown> | null;
  output_capture_key: string | null;
  fallback_route_id: string | null;
  rollback_tool_id: string | null;
};

type ToolLookup = {
  id: string;
  name: string;
  display_name: string | null;
  server_id: string | null;
};
type ServerLookup = { id: string; name: string };
type RouteLookup = { id: string; name: string };

const since24hIso = (): string =>
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export const fetchOrgRoutes = async (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<RouteListItem[]> => {
  const [routesRes, stepsRes, eventsRes] = await Promise.all([
    supabase
      .from('routes')
      .select('id, name, description')
      .eq('organization_id', organizationId)
      .order('name'),
    supabase.from('route_steps').select('route_id'),
    supabase
      .from('mcp_events')
      .select('payload_redacted, status')
      .eq('organization_id', organizationId)
      .eq('method', 'execute_route')
      .gte('created_at', since24hIso()),
  ]);
  if (routesRes.error) throw new Error(`routes_fetch_failed: ${routesRes.error.message}`);
  if (stepsRes.error) throw new Error(`route_steps_fetch_failed: ${stepsRes.error.message}`);
  if (eventsRes.error) throw new Error(`route_events_fetch_failed: ${eventsRes.error.message}`);

  const counts = new Map<string, number>();
  for (const row of (stepsRes.data ?? []) as { route_id: string }[]) {
    counts.set(row.route_id, (counts.get(row.route_id) ?? 0) + 1);
  }

  // Bucket execute_route events by route_id (lives in payload_redacted.route_id).
  const statsByRoute = new Map<string, { runs: number; ok: number; errors: number }>();
  for (const ev of (eventsRes.data ?? []) as McpEventRow[]) {
    const routeId = (ev.payload_redacted as { route_id?: string } | null)?.route_id;
    if (!routeId) continue;
    const cur = statsByRoute.get(routeId) ?? { runs: 0, ok: 0, errors: 0 };
    cur.runs += 1;
    if (ev.status === 'ok') cur.ok += 1;
    else cur.errors += 1;
    statsByRoute.set(routeId, cur);
  }

  return (routesRes.data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    step_count: counts.get(r.id as string) ?? 0,
    stats_24h: statsByRoute.get(r.id as string) ?? { runs: 0, ok: 0, errors: 0 },
  }));
};

type McpEventRow = {
  payload_redacted: unknown;
  status: string;
};

export const fetchRouteDetail = async (
  supabase: SupabaseClient,
  organizationId: string,
  routeId: string,
): Promise<RouteDetail | null> => {
  const routeRes = await supabase
    .from('routes')
    .select('id, organization_id, domain_id, name, description')
    .eq('id', routeId)
    .maybeSingle();
  if (routeRes.error) throw new Error(`route_fetch_failed: ${routeRes.error.message}`);
  const route = routeRes.data as RouteRow | null;
  if (!route || route.organization_id !== organizationId) return null;

  const stepsRes = await supabase
    .from('route_steps')
    .select(
      'id, route_id, step_order, tool_id, input_mapping, rollback_input_mapping, fallback_input_mapping, fallback_rollback_input_mapping, output_capture_key, fallback_route_id, rollback_tool_id',
    )
    .eq('route_id', routeId)
    .order('step_order');
  if (stepsRes.error) throw new Error(`steps_fetch_failed: ${stepsRes.error.message}`);
  const steps = (stepsRes.data ?? []) as StepRow[];

  const toolIds = new Set<string>();
  const fallbackRouteIds = new Set<string>();
  for (const s of steps) {
    toolIds.add(s.tool_id);
    if (s.rollback_tool_id) toolIds.add(s.rollback_tool_id);
    if (s.fallback_route_id) fallbackRouteIds.add(s.fallback_route_id);
  }

  const [toolsRes, fallbackRoutesRes] = await Promise.all([
    toolIds.size
      ? supabase
          .from('tools')
          .select('id, name, display_name, server_id')
          .in('id', Array.from(toolIds))
      : Promise.resolve({ data: [] as ToolLookup[], error: null }),
    fallbackRouteIds.size
      ? supabase.from('routes').select('id, name').in('id', Array.from(fallbackRouteIds))
      : Promise.resolve({ data: [] as RouteLookup[], error: null }),
  ]);
  if (toolsRes.error) throw new Error(`tools_lookup_failed: ${toolsRes.error.message}`);
  if (fallbackRoutesRes.error)
    throw new Error(`fallback_routes_lookup_failed: ${fallbackRoutesRes.error.message}`);

  const toolById = new Map<string, ToolLookup>();
  const serverIds = new Set<string>();
  for (const t of (toolsRes.data ?? []) as ToolLookup[]) {
    toolById.set(t.id, t);
    if (t.server_id) serverIds.add(t.server_id);
  }

  const serversRes = serverIds.size === 0
    ? { data: [] as ServerLookup[], error: null }
    : await supabase.from('servers').select('id, name').in('id', Array.from(serverIds));
  if (serversRes.error) throw new Error(`servers_lookup_failed: ${serversRes.error.message}`);
  const serverById = new Map<string, ServerLookup>();
  for (const s of (serversRes.data ?? []) as ServerLookup[]) serverById.set(s.id, s);

  const routeById = new Map<string, RouteLookup>();
  for (const r of (fallbackRoutesRes.data ?? []) as RouteLookup[]) routeById.set(r.id, r);

  return {
    id: route.id,
    name: route.name,
    description: route.description,
    domain_id: route.domain_id,
    steps: steps.map((s) => {
      const tool = toolById.get(s.tool_id);
      const rollbackTool = s.rollback_tool_id ? toolById.get(s.rollback_tool_id) : null;
      const fallbackRoute = s.fallback_route_id ? routeById.get(s.fallback_route_id) : null;
      const toolServer = tool?.server_id ? serverById.get(tool.server_id) ?? null : null;
      const rollbackServer = rollbackTool?.server_id
        ? serverById.get(rollbackTool.server_id) ?? null
        : null;
      return {
        id: s.id,
        step_order: s.step_order,
        tool_id: s.tool_id,
        tool_name: tool?.name ?? '-',
        tool_display_name: tool?.display_name ?? null,
        tool_server_id: toolServer?.id ?? null,
        tool_server_name: toolServer?.name ?? null,
        input_mapping: s.input_mapping ?? {},
        rollback_input_mapping: s.rollback_input_mapping,
        fallback_input_mapping: s.fallback_input_mapping,
        fallback_rollback_input_mapping: s.fallback_rollback_input_mapping,
        output_capture_key: s.output_capture_key,
        fallback_route_id: s.fallback_route_id,
        fallback_route_name: fallbackRoute?.name ?? null,
        rollback_tool_id: s.rollback_tool_id,
        rollback_tool_name: rollbackTool?.name ?? null,
        rollback_tool_server_id: rollbackServer?.id ?? null,
        rollback_tool_server_name: rollbackServer?.name ?? null,
      };
    }),
  };
};

// Latest top-level execute_route event for a given route, drives the
// "Last ran 2h ago, succeeded" breadcrumb on the detail page.
export type LatestRouteRun = {
  trace_id: string;
  status: string;
  latency_ms: number | null;
  created_at: string;
  halted_at_step: number | null;
};

export const fetchLatestRouteRun = async (
  supabase: SupabaseClient,
  organizationId: string,
  routeId: string,
): Promise<LatestRouteRun | null> => {
  const { data, error } = await supabase
    .from('mcp_events')
    .select('trace_id, status, latency_ms, payload_redacted, created_at')
    .eq('organization_id', organizationId)
    .eq('method', 'execute_route')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`latest_run_fetch_failed: ${error.message}`);
  const rows = (data ?? []) as {
    trace_id: string;
    status: string;
    latency_ms: number | null;
    payload_redacted: unknown;
    created_at: string;
  }[];
  for (const r of rows) {
    const payloadRouteId = (r.payload_redacted as { route_id?: string; halted_at_step?: number } | null)?.route_id;
    if (payloadRouteId !== routeId) continue;
    const halted =
      (r.payload_redacted as { halted_at_step?: number } | null)?.halted_at_step ?? null;
    return {
      trace_id: r.trace_id,
      status: r.status,
      latency_ms: r.latency_ms,
      created_at: r.created_at,
      halted_at_step: halted,
    };
  }
  return null;
};
