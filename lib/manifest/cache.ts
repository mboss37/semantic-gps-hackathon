import { createServiceClient } from '@/lib/supabase/service';

// In-memory compiled manifest for the MCP gateway. Stateless route still
// shares a process cache across warm invocations. Every mutation route MUST
// call invalidateManifest() before returning — it's the rule that makes
// live policy reload work.

export type ServerRow = {
  id: string;
  organization_id: string;
  domain_id: string | null;
  name: string;
  origin_url: string | null;
  transport: 'http-streamable' | 'openapi' | 'salesforce' | 'slack' | 'github';
  openapi_spec: unknown;
  auth_config: unknown;
  created_at: string;
};

export type DomainRow = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type ToolRow = {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  input_schema: unknown;
  // Semantic rewriting (WP-G.6). Nullable columns that may be absent on
  // legacy fixtures or pre-migration rows; `?:` reflects both "not present"
  // and "present but null". Stateless server uses `?? t.name` which handles
  // both uniformly.
  display_name?: string | null;
  display_description?: string | null;
};

export type RelationshipRow = {
  id: string;
  from_tool_id: string;
  to_tool_id: string;
  relationship_type:
    | 'produces_input_for'
    | 'requires_before'
    | 'suggests_after'
    | 'mutually_exclusive'
    | 'alternative_to'
    | 'validates'
    | 'compensated_by'
    | 'fallback_to';
  description: string;
};

export type PolicyRow = {
  id: string;
  name: string;
  builtin_key:
    | 'pii_redaction'
    | 'rate_limit'
    | 'allowlist'
    | 'injection_guard'
    | 'basic_auth'
    | 'client_id'
    | 'ip_allowlist'
    | 'business_hours'
    | 'write_freeze'
    | 'geo_fence'
    | 'agent_identity_required'
    | 'idempotency_required';
  config: Record<string, unknown>;
  enforcement_mode: 'shadow' | 'enforce';
};

export type PolicyAssignmentRow = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

export type RouteRow = {
  id: string;
  organization_id: string;
  domain_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
};

export type RouteStepRow = {
  id: string;
  route_id: string;
  step_order: number;
  tool_id: string;
  input_mapping: Record<string, unknown>;
  output_capture_key: string | null;
  fallback_route_id: string | null;
  rollback_tool_id: string | null;
  created_at: string;
};

export type Manifest = {
  loadedAt: number;
  servers: ServerRow[];
  tools: ToolRow[];
  relationships: RelationshipRow[];
  policies: PolicyRow[];
  assignments: PolicyAssignmentRow[];
  routes: RouteRow[];
  route_steps: RouteStepRow[];
};

export type ManifestScope =
  | { kind: 'org'; organization_id: string }
  | { kind: 'domain'; organization_id: string; domain_slug: string }
  | { kind: 'server'; organization_id: string; server_id: string };

// Deterministic key for the per-scope manifest cache. JSON.stringify is fine
// here — our three scope shapes have stable key orders.
const scopeKey = (scope: ManifestScope): string => {
  if (scope.kind === 'org') return `org:${scope.organization_id}`;
  if (scope.kind === 'domain')
    return `domain:${scope.organization_id}:${scope.domain_slug}`;
  return `server:${scope.organization_id}:${scope.server_id}`;
};

const cache = new Map<string, Manifest>();
const inflight = new Map<string, Promise<Manifest>>();

const emptyManifest = (): Manifest => ({
  loadedAt: Date.now(),
  servers: [],
  tools: [],
  relationships: [],
  policies: [],
  assignments: [],
  routes: [],
  route_steps: [],
});

// Three scope-aware loaders. Each returns the exact row slice the gateway
// should see at that tier. Scoping lives here (not in route handlers) so the
// cache key matches the actual data shape.
const fetchOrgManifest = async (
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
): Promise<Manifest> => {
  const [servers, policies, assignments, routes, routeSteps] = await Promise.all([
    supabase.from('servers').select('*').eq('organization_id', organizationId),
    supabase.from('policies').select('*'),
    supabase.from('policy_assignments').select('*'),
    supabase.from('routes').select('*').eq('organization_id', organizationId),
    supabase.from('route_steps').select('*'),
  ]);

  const serverRows = (servers.data ?? []) as ServerRow[];
  const serverIds = serverRows.map((s) => s.id);

  const toolsQ =
    serverIds.length === 0
      ? { data: [] as ToolRow[], error: null }
      : await supabase.from('tools').select('*').in('server_id', serverIds);
  const toolRows = (toolsQ.data ?? []) as ToolRow[];
  const toolIds = toolRows.map((t) => t.id);

  const relsQ =
    toolIds.length === 0
      ? { data: [] as RelationshipRow[], error: null }
      : await supabase
          .from('relationships')
          .select('*')
          .in('from_tool_id', toolIds)
          .in('to_tool_id', toolIds);

  const errs = [
    servers.error,
    policies.error,
    assignments.error,
    routes.error,
    routeSteps.error,
    toolsQ.error,
    relsQ.error,
  ].filter(Boolean);
  if (errs.length > 0) {
    throw new Error(`manifest load failed: ${errs.map((e) => e?.message).join('; ')}`);
  }

  return {
    loadedAt: Date.now(),
    servers: serverRows,
    tools: toolRows,
    relationships: (relsQ.data ?? []) as RelationshipRow[],
    policies: (policies.data ?? []) as PolicyRow[],
    assignments: (assignments.data ?? []) as PolicyAssignmentRow[],
    routes: (routes.data ?? []) as RouteRow[],
    route_steps: (routeSteps.data ?? []) as RouteStepRow[],
  };
};

const fetchDomainManifest = async (
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  domainSlug: string,
): Promise<Manifest> => {
  const { data: domain, error: domainErr } = await supabase
    .from('domains')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('slug', domainSlug)
    .maybeSingle();
  if (domainErr) throw new Error(`manifest load failed: ${domainErr.message}`);
  if (!domain) return emptyManifest();

  const { data: serverRowsRaw, error: serversErr } = await supabase
    .from('servers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('domain_id', domain.id);
  if (serversErr) throw new Error(`manifest load failed: ${serversErr.message}`);
  const serverRows = (serverRowsRaw ?? []) as ServerRow[];
  const serverIds = serverRows.map((s) => s.id);

  const [toolsQ, routesQ, policiesQ, assignmentsQ] = await Promise.all([
    serverIds.length === 0
      ? Promise.resolve({ data: [] as ToolRow[], error: null })
      : supabase.from('tools').select('*').in('server_id', serverIds),
    supabase.from('routes').select('*').eq('organization_id', organizationId).eq('domain_id', domain.id),
    supabase.from('policies').select('*'),
    supabase.from('policy_assignments').select('*'),
  ]);

  const toolRows = (toolsQ.data ?? []) as ToolRow[];
  const toolIds = toolRows.map((t) => t.id);
  const routeRows = (routesQ.data ?? []) as RouteRow[];
  const routeIds = routeRows.map((r) => r.id);

  const [relsQ, stepsQ] = await Promise.all([
    toolIds.length === 0
      ? Promise.resolve({ data: [] as RelationshipRow[], error: null })
      : supabase
          .from('relationships')
          .select('*')
          .in('from_tool_id', toolIds)
          .in('to_tool_id', toolIds),
    routeIds.length === 0
      ? Promise.resolve({ data: [] as RouteStepRow[], error: null })
      : supabase.from('route_steps').select('*').in('route_id', routeIds),
  ]);

  const errs = [
    toolsQ.error,
    routesQ.error,
    policiesQ.error,
    assignmentsQ.error,
    relsQ.error,
    stepsQ.error,
  ].filter(Boolean);
  if (errs.length > 0) {
    throw new Error(`manifest load failed: ${errs.map((e) => e?.message).join('; ')}`);
  }

  return {
    loadedAt: Date.now(),
    servers: serverRows,
    tools: toolRows,
    relationships: (relsQ.data ?? []) as RelationshipRow[],
    policies: (policiesQ.data ?? []) as PolicyRow[],
    assignments: (assignmentsQ.data ?? []) as PolicyAssignmentRow[],
    routes: routeRows,
    route_steps: (stepsQ.data ?? []) as RouteStepRow[],
  };
};

const fetchServerManifest = async (
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  serverId: string,
): Promise<Manifest> => {
  const { data: serverRow, error: serverErr } = await supabase
    .from('servers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', serverId)
    .maybeSingle();
  if (serverErr) throw new Error(`manifest load failed: ${serverErr.message}`);
  if (!serverRow) return emptyManifest();

  const { data: toolRowsRaw, error: toolsErr } = await supabase
    .from('tools')
    .select('*')
    .eq('server_id', serverId);
  if (toolsErr) throw new Error(`manifest load failed: ${toolsErr.message}`);
  const toolRows = (toolRowsRaw ?? []) as ToolRow[];
  const toolIds = toolRows.map((t) => t.id);

  const [relsQ, policiesQ, assignmentsQ] = await Promise.all([
    toolIds.length === 0
      ? Promise.resolve({ data: [] as RelationshipRow[], error: null })
      : supabase
          .from('relationships')
          .select('*')
          .in('from_tool_id', toolIds)
          .in('to_tool_id', toolIds),
    supabase.from('policies').select('*'),
    supabase.from('policy_assignments').select('*'),
  ]);

  const errs = [relsQ.error, policiesQ.error, assignmentsQ.error].filter(Boolean);
  if (errs.length > 0) {
    throw new Error(`manifest load failed: ${errs.map((e) => e?.message).join('; ')}`);
  }

  return {
    loadedAt: Date.now(),
    servers: [serverRow as ServerRow],
    tools: toolRows,
    relationships: (relsQ.data ?? []) as RelationshipRow[],
    policies: (policiesQ.data ?? []) as PolicyRow[],
    assignments: (assignmentsQ.data ?? []) as PolicyAssignmentRow[],
    routes: [],
    route_steps: [],
  };
};

const fetchManifest = async (scope: ManifestScope): Promise<Manifest> => {
  // Graceful degrade in test / CLI envs that don't wire Supabase — gateway
  // stays functional (no manifest = just the builtin echo tool).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return emptyManifest();
  }
  const supabase = createServiceClient();
  if (scope.kind === 'org') return fetchOrgManifest(supabase, scope.organization_id);
  if (scope.kind === 'domain')
    return fetchDomainManifest(supabase, scope.organization_id, scope.domain_slug);
  return fetchServerManifest(supabase, scope.organization_id, scope.server_id);
};

export const loadManifest = async (scope: ManifestScope): Promise<Manifest> => {
  const key = scopeKey(scope);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = fetchManifest(scope)
    .then((m) => {
      cache.set(key, m);
      return m;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
};

export const invalidateManifest = (): void => {
  cache.clear();
};
