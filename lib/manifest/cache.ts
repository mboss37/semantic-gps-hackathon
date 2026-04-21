import { createServiceClient } from '@/lib/supabase/service';

// In-memory compiled manifest for the MCP gateway. Stateless route still
// shares a process cache across warm invocations. Every mutation route MUST
// call invalidateManifest() before returning — it's the rule that makes
// live policy reload work.

export type ServerRow = {
  id: string;
  user_id: string | null;
  name: string;
  origin_url: string | null;
  transport: 'http-streamable' | 'openapi';
  openapi_spec: unknown;
  auth_config: unknown;
  created_at: string;
};

export type ToolRow = {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  input_schema: unknown;
};

export type RelationshipRow = {
  id: string;
  from_tool_id: string;
  to_tool_id: string;
  relationship_type:
    | 'depends_on'
    | 'composes_into'
    | 'alternative_to'
    | 'prerequisite'
    | 'conflicts_with'
    | 'enables'
    | 'requires_auth'
    | 'deprecated_by';
  description: string;
};

export type PolicyRow = {
  id: string;
  name: string;
  builtin_key: 'pii_redaction' | 'rate_limit' | 'allowlist' | 'injection_guard';
  config: Record<string, unknown>;
  enforcement_mode: 'shadow' | 'enforce';
};

export type PolicyAssignmentRow = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

export type Manifest = {
  loadedAt: number;
  servers: ServerRow[];
  tools: ToolRow[];
  relationships: RelationshipRow[];
  policies: PolicyRow[];
  assignments: PolicyAssignmentRow[];
};

let cached: Manifest | null = null;
let inflight: Promise<Manifest> | null = null;

const fetchManifest = async (): Promise<Manifest> => {
  const supabase = createServiceClient();
  const [servers, tools, relationships, policies, assignments] = await Promise.all([
    supabase.from('servers').select('*'),
    supabase.from('tools').select('*'),
    supabase.from('relationships').select('*'),
    supabase.from('policies').select('*'),
    supabase.from('policy_assignments').select('*'),
  ]);

  const errs = [servers.error, tools.error, relationships.error, policies.error, assignments.error].filter(Boolean);
  if (errs.length > 0) {
    throw new Error(`manifest load failed: ${errs.map((e) => e?.message).join('; ')}`);
  }

  return {
    loadedAt: Date.now(),
    servers: (servers.data ?? []) as ServerRow[],
    tools: (tools.data ?? []) as ToolRow[],
    relationships: (relationships.data ?? []) as RelationshipRow[],
    policies: (policies.data ?? []) as PolicyRow[],
    assignments: (assignments.data ?? []) as PolicyAssignmentRow[],
  };
};

export const loadManifest = async (): Promise<Manifest> => {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetchManifest()
    .then((m) => {
      cached = m;
      return m;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const invalidateManifest = (): void => {
  cached = null;
};
