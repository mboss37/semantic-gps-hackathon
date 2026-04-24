// Read-only Server detail helpers for the /dashboard/servers/[id] page.
// Two helpers:
//   • fetchServerDetail(supabase, org, id) — server row + tools + 7-day
//     violation counts. UI surface exposes `has_auth` bool only; raw
//     `authConfig` is attached as a server-only internal field for the
//     capabilities-introspection path to consume (never pass to Client
//     Components). Cross-org id requests return null (same 404 pattern as
//     lib/routes/fetch.ts).
//   • fetchRemoteCapabilities(server) — live JSON-RPC introspection of an MCP
//     origin's resources/list + prompts/list. Only attempts for transport
//     'http-streamable'; all other transports early-return `null` capabilities
//     (they don't speak MCP JSON-RPC). -32601 method-not-found becomes []
//     (method missing ≠ error).
//
// Violations aggregation is JS-side from `mcp_events.policy_decisions` jsonb
// — mirrors app/api/policies/[id]/timeline/route.ts. At demo scale the plain
// SELECT + loop beats an RPC; past ~10k rows/day we'd push to Postgres.

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import { decodeAuthConfig, type AuthConfig } from '@/lib/servers/auth';

export type ServerDetailRow = {
  id: string;
  name: string;
  origin_url: string | null;
  transport: 'openapi' | 'http-streamable';
  has_auth: boolean;
  created_at: string;
};

export type ServerDetailTool = {
  id: string;
  name: string;
  description: string | null;
  display_name: string | null;
  display_description: string | null;
};

export type ViolationCount = {
  policy_name: string;
  count: number;
};

export type ServerDetail = {
  server: ServerDetailRow;
  tools: ServerDetailTool[];
  violationsByPolicy: ViolationCount[];
  /**
   * Server-only: raw auth_config from the DB (encrypted envelope or legacy
   * plaintext). Used by fetchRemoteCapabilities for MCP introspection. NEVER
   * pass this to Client Components — the UI reads `server.has_auth` instead.
   */
  authConfig: unknown;
};

type ServerRow = {
  id: string;
  organization_id: string;
  name: string;
  origin_url: string | null;
  transport: ServerDetailRow['transport'];
  auth_config: unknown;
  created_at: string;
};

type ToolRow = {
  id: string;
  server_id: string;
  name: string;
  description: string | null;
  display_name: string | null;
  display_description: string | null;
};

type PolicyDecisionEntry = {
  policy_name: string;
  decision: 'allow' | 'block' | 'redact';
  mode?: 'shadow' | 'enforce';
};

type EventRow = {
  status: string;
  policy_decisions: unknown;
};

const WINDOW_DAYS = 7;

const computeHasAuth = (authConfig: unknown): boolean => {
  if (authConfig === null || authConfig === undefined) return false;
  if (typeof authConfig !== 'object') return false;
  // Encrypted envelope shape ({ ciphertext: "..." }) or legacy plaintext
  // ({ type: 'bearer'|'none'|... }) both live in this column. Anything with
  // non-empty content is treated as "auth is configured" for the UI badge.
  return Object.keys(authConfig as Record<string, unknown>).length > 0;
};

const aggregateViolations = (rows: EventRow[]): ViolationCount[] => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== 'blocked_by_policy') continue;
    const decisions = Array.isArray(row.policy_decisions)
      ? (row.policy_decisions as PolicyDecisionEntry[])
      : [];
    for (const d of decisions) {
      if (d.decision !== 'block') continue;
      if (!d.policy_name) continue;
      counts.set(d.policy_name, (counts.get(d.policy_name) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([policy_name, count]) => ({ policy_name, count }))
    .sort((a, b) => (b.count - a.count) || a.policy_name.localeCompare(b.policy_name));
};

export const fetchServerDetail = async (
  supabase: SupabaseClient,
  organizationId: string,
  serverId: string,
): Promise<ServerDetail | null> => {
  const serverRes = await supabase
    .from('servers')
    .select('id, organization_id, name, origin_url, transport, auth_config, created_at')
    .eq('id', serverId)
    .maybeSingle();
  if (serverRes.error) throw new Error(`server_fetch_failed: ${serverRes.error.message}`);
  const server = serverRes.data as ServerRow | null;
  if (!server || server.organization_id !== organizationId) return null;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [toolsRes, eventsRes] = await Promise.all([
    supabase
      .from('tools')
      .select('id, server_id, name, description, display_name, display_description')
      .eq('server_id', serverId)
      .order('name'),
    supabase
      .from('mcp_events')
      .select('status, policy_decisions')
      .eq('server_id', serverId)
      .gte('created_at', since),
  ]);
  if (toolsRes.error) throw new Error(`tools_fetch_failed: ${toolsRes.error.message}`);
  if (eventsRes.error) throw new Error(`events_fetch_failed: ${eventsRes.error.message}`);

  const tools = ((toolsRes.data ?? []) as ToolRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    display_name: t.display_name,
    display_description: t.display_description,
  }));
  const violationsByPolicy = aggregateViolations((eventsRes.data ?? []) as EventRow[]);

  return {
    server: {
      id: server.id,
      name: server.name,
      origin_url: server.origin_url,
      transport: server.transport,
      has_auth: computeHasAuth(server.auth_config),
      created_at: server.created_at,
    },
    tools,
    violationsByPolicy,
    authConfig: server.auth_config,
  };
};

// ---- Remote capabilities (resources/list + prompts/list) -----------------

export type RemoteResource = {
  uri: string;
  name: string;
  description: string | null;
  mimeType: string | null;
};

export type RemotePrompt = {
  name: string;
  description: string | null;
};

export type RemoteCapabilities = {
  resources: RemoteResource[] | null;
  prompts: RemotePrompt[] | null;
  error: string | null;
};

export type CapabilitySourceServer = {
  transport: ServerDetailRow['transport'];
  origin_url: string | null;
  auth_config?: unknown;
};

const REMOTE_TIMEOUT_MS = 3_000;

// Narrow Zod schema covering just the fields we render. The full MCP SDK
// types are massive; a surface-only schema keeps type noise + parse cost low.
const ResourceLoose = z
  .object({
    uri: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    mimeType: z.string().optional(),
  })
  .passthrough();

const PromptLoose = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .passthrough();

const RpcResponse = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

const parseBody = (text: string, contentType: string): unknown => {
  if (contentType.includes('text/event-stream')) {
    const match = text.match(/data:\s*(\{[\s\S]*?\})\s*$/m);
    if (!match) throw new Error('sse_no_data_event');
    return JSON.parse(match[1]);
  }
  return JSON.parse(text);
};

type RpcCallResult<T> =
  | { ok: true; list: T[] }
  | { ok: false; error: string };

const rpcList = async <T>(
  originUrl: string,
  auth: AuthConfig,
  method: 'resources/list' | 'prompts/list',
  itemKey: 'resources' | 'prompts',
  rowSchema: z.ZodTypeAny,
): Promise<RpcCallResult<T>> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (auth.type === 'bearer') headers.authorization = `Bearer ${auth.token}`;

  let res: Response;
  try {
    res = await safeFetch(originUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: itemKey, method, params: {} }),
      timeoutMs: REMOTE_TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: 'ssrf_blocked' };
    return { ok: false, error: 'network_error' };
  }

  if (!res.ok) return { ok: false, error: `upstream_http_${res.status}` };

  const text = await res.text();
  let body: unknown;
  try {
    body = parseBody(text, res.headers.get('content-type') ?? '');
  } catch {
    return { ok: false, error: 'parse_error' };
  }
  const parsed = RpcResponse.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'invalid_jsonrpc' };

  if (parsed.data.error) {
    // -32601 = method not found. Standard MCP signal that the origin just
    // doesn't implement this capability — treat as empty list, not an error.
    if (parsed.data.error.code === -32601) return { ok: true, list: [] };
    return { ok: false, error: 'upstream_jsonrpc_error' };
  }

  const result = parsed.data.result;
  if (!result || typeof result !== 'object') return { ok: true, list: [] };
  const items = (result as Record<string, unknown>)[itemKey];
  if (!Array.isArray(items)) return { ok: true, list: [] };

  const out: T[] = [];
  for (const item of items) {
    const row = rowSchema.safeParse(item);
    if (row.success) out.push(row.data as T);
  }
  return { ok: true, list: out };
};

export const fetchRemoteCapabilities = async (
  server: CapabilitySourceServer,
): Promise<RemoteCapabilities> => {
  if (server.transport !== 'http-streamable') {
    return { resources: null, prompts: null, error: null };
  }
  if (!server.origin_url) {
    return { resources: null, prompts: null, error: 'origin_url_missing' };
  }

  let auth: AuthConfig;
  try {
    auth = decodeAuthConfig(server.auth_config);
  } catch {
    auth = { type: 'none' };
  }

  const [resRes, prmRes] = await Promise.all([
    rpcList<z.infer<typeof ResourceLoose>>(
      server.origin_url,
      auth,
      'resources/list',
      'resources',
      ResourceLoose,
    ),
    rpcList<z.infer<typeof PromptLoose>>(
      server.origin_url,
      auth,
      'prompts/list',
      'prompts',
      PromptLoose,
    ),
  ]);

  // If both calls errored identically the origin is probably unreachable —
  // surface the first error. If one succeeded, prefer that signal.
  const firstError = !resRes.ok ? resRes.error : !prmRes.ok ? prmRes.error : null;

  const resources = resRes.ok
    ? resRes.list.map((r) => ({
        uri: r.uri,
        name: r.name ?? r.uri,
        description: r.description ?? null,
        mimeType: r.mimeType ?? null,
      }))
    : null;
  const prompts = prmRes.ok
    ? prmRes.list.map((p) => ({
        name: p.name,
        description: p.description ?? null,
      }))
    : null;

  return { resources, prompts, error: firstError };
};
