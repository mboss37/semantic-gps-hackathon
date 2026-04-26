import type { SupabaseClient } from '@supabase/supabase-js';

import type { RouteImport, RouteStepImport } from '@/lib/schemas/route-import';

// Sprint 28 WP-28.1: pure import logic, separated from the HTTP layer so it
// can be unit-tested with a mocked Supabase client. Returns a discriminated
// union the caller maps to HTTP status codes.

export type ImportResult =
  | { ok: true; route_id: string; step_count: number }
  | { ok: false; status: 400 | 409 | 500; error: string; details?: string };

const toolKey = (server: string, tool: string): string => `${server}::${tool}`;

// Pre-fetch every (server, tool) pair the caller's org owns and build an
// in-memory lookup map. Avoids a per-step round-trip and keeps the SQL
// portable (no composite-tuple IN clauses).
const fetchOrgToolIndex = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  organizationId: string,
): Promise<Map<string, string> | { error: string }> => {
  const { data, error } = await supabase
    .from('tools')
    .select('id, name, servers!inner(name, organization_id)')
    .eq('servers.organization_id', organizationId);
  if (error) return { error: error.message };

  // PostgREST returns to-one FK embeds as a single object at runtime, but
  // Supabase JS's generated types declare an array (Sprint 27 gotcha + the
  // pattern used in lib/policies/assignments.ts). Cast through unknown.
  type Row = { id: string; name: string; servers: { name: string } | null };
  const rows = (data as unknown as Row[] | null) ?? [];
  const index = new Map<string, string>();
  for (const row of rows) {
    const server = row.servers?.name;
    if (server) index.set(toolKey(server, row.name), row.id);
  }
  return index;
};

const resolveToolRefs = (
  step: RouteStepImport,
  index: Map<string, string>,
): { primary_tool_id: string; rollback_tool_id: string | null } | { missing: string } => {
  const primary = index.get(toolKey(step.server_name, step.tool_name));
  if (!primary) {
    return { missing: `tool '${step.tool_name}' on server '${step.server_name}'` };
  }
  if (step.rollback_server_name && step.rollback_tool_name) {
    const rollback = index.get(toolKey(step.rollback_server_name, step.rollback_tool_name));
    if (!rollback) {
      return {
        missing: `rollback tool '${step.rollback_tool_name}' on server '${step.rollback_server_name}'`,
      };
    }
    return { primary_tool_id: primary, rollback_tool_id: rollback };
  }
  return { primary_tool_id: primary, rollback_tool_id: null };
};

export const importRoute = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  organizationId: string,
  input: RouteImport,
): Promise<ImportResult> => {
  // Collision check. App-layer only because there's no (org, name) UNIQUE
  // on the routes table yet. Documented as v2 follow-up. Race window at
  // hackathon scale is not a real concern.
  const { data: existing, error: existingErr } = await supabase
    .from('routes')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', input.name)
    .maybeSingle();
  if (existingErr) {
    return { ok: false, status: 500, error: 'lookup failed', details: existingErr.message };
  }
  if (existing) {
    return { ok: false, status: 409, error: 'duplicate', details: 'route name already exists in this org' };
  }

  // Tool index resolution.
  const indexResult = await fetchOrgToolIndex(supabase, organizationId);
  if (!(indexResult instanceof Map)) {
    return { ok: false, status: 500, error: 'tool lookup failed', details: indexResult.error };
  }
  const resolved: Array<{ step: RouteStepImport; primary: string; rollback: string | null }> = [];
  for (const step of input.steps) {
    const ids = resolveToolRefs(step, indexResult);
    if ('missing' in ids) {
      return { ok: false, status: 400, error: 'tool not found', details: ids.missing };
    }
    resolved.push({ step, primary: ids.primary_tool_id, rollback: ids.rollback_tool_id });
  }

  // Insert route.
  const { data: route, error: routeErr } = await supabase
    .from('routes')
    .insert({
      organization_id: organizationId,
      domain_id: input.domain_id ?? null,
      name: input.name,
      description: input.description ?? null,
    })
    .select('id')
    .single();
  if (routeErr || !route) {
    return {
      ok: false,
      status: 500,
      error: 'route insert failed',
      details: routeErr?.message,
    };
  }

  // Insert steps as a single batch. JSONB mappings pass through unchanged.
  const stepRows = resolved.map(({ step, primary, rollback }) => ({
    route_id: route.id,
    step_order: step.step_order,
    tool_id: primary,
    input_mapping: step.input_mapping,
    output_capture_key: step.output_capture_key ?? null,
    rollback_tool_id: rollback,
    rollback_input_mapping: step.rollback_input_mapping ?? null,
    fallback_input_mapping: step.fallback_input_mapping ?? null,
    fallback_rollback_input_mapping: step.fallback_rollback_input_mapping ?? null,
  }));
  const { error: stepsErr } = await supabase.from('route_steps').insert(stepRows);
  if (stepsErr) {
    // Manual rollback. Same pattern as openapi-import.
    await supabase.from('routes').delete().eq('id', route.id);
    return {
      ok: false,
      status: 500,
      error: 'route_steps insert failed',
      details: stepsErr.message,
    };
  }

  return { ok: true, route_id: route.id, step_count: stepRows.length };
};
