import { z } from 'zod';
import { decrypt } from '@/lib/crypto/encrypt';
import type { ServerRow, ToolRow } from '@/lib/manifest/cache';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import { createServiceClient } from '@/lib/supabase/service';

// Real direct-MCP proxy. For servers where transport='http-streamable'
// (another MCP server registered into our gateway) we forward the tools/call
// JSON-RPC frame upstream with the decrypted bearer. Upstream may reply as
// plain JSON or a single SSE event — both shapes land on the same return
// contract as proxy-openapi.

const TIMEOUT_MS = 10_000;

export type ProxyOk = { ok: true; result: unknown; latencyMs: number };
export type ProxyErr = { ok: false; error: string; status?: number };
export type ProxyResult = ProxyOk | ProxyErr;

export type ProxyContext = {
  serverId: string;
  traceId: string;
};

const EncryptedAuthSchema = z.object({ ciphertext: z.string().min(1) });

const AuthConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().min(1) }),
]);

type AuthConfig = z.infer<typeof AuthConfigSchema>;

const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

type ServerRecord = Pick<ServerRow, 'id' | 'origin_url' | 'auth_config' | 'transport'>;

const decodeAuthConfig = (raw: unknown): AuthConfig => {
  if (raw === null || raw === undefined) return { type: 'none' };
  const envelope = EncryptedAuthSchema.safeParse(raw);
  if (!envelope.success) return { type: 'none' };
  const plaintext = decrypt(envelope.data.ciphertext);
  const parsed: unknown = JSON.parse(plaintext);
  const auth = AuthConfigSchema.safeParse(parsed);
  if (!auth.success) return { type: 'none' };
  return auth.data;
};

const loadServer = async (serverId: string): Promise<ServerRecord | null> => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('servers')
    .select('id, origin_url, auth_config, transport')
    .eq('id', serverId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ServerRecord;
};

// Parse either plain-JSON or an SSE-style body. We pick out a single `data:`
// event — multi-event streams are a BACKLOG item. Lenient regex mirrors the
// discover-tools parser so upstream behavior stays consistent.
const parseBody = (text: string, contentType: string): unknown => {
  if (contentType.includes('text/event-stream')) {
    const match = text.match(/data:\s*(\{[\s\S]*?\})\s*$/m);
    if (!match) throw new Error('sse_no_data_event');
    return JSON.parse(match[1]);
  }
  return JSON.parse(text);
};

const extractResult = (result: unknown): unknown => {
  if (result && typeof result === 'object' && 'content' in result) {
    const content = (result as { content?: unknown }).content;
    if (content !== undefined) return content;
  }
  return result;
};

export const proxyHttp = async (
  tool: ToolRow,
  args: Record<string, unknown>,
  ctx: ProxyContext,
): Promise<ProxyResult> => {
  const started = performance.now();

  const server = await loadServer(ctx.serverId);
  if (!server) return { ok: false, error: 'server_not_found' };
  if (server.transport !== 'http-streamable') return { ok: false, error: 'wrong_transport' };
  if (!server.origin_url) return { ok: false, error: 'origin_url_missing' };

  let auth: AuthConfig;
  try {
    auth = decodeAuthConfig(server.auth_config);
  } catch {
    return { ok: false, error: 'auth_decode_failed' };
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (auth.type === 'bearer') headers.authorization = `Bearer ${auth.token}`;

  const payload = {
    jsonrpc: '2.0' as const,
    id: ctx.traceId,
    method: 'tools/call',
    params: { name: tool.name, arguments: args },
  };

  let res: Response;
  try {
    res = await safeFetch(server.origin_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: 'ssrf_blocked' };
    return { ok: false, error: 'network_error' };
  }

  const latencyMs = Math.round(performance.now() - started);

  if (!res.ok) {
    await res.text().catch(() => '');
    return { ok: false, error: 'upstream_error', status: res.status };
  }

  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? '';
  let body: unknown;
  try {
    body = parseBody(text, contentType);
  } catch {
    return { ok: false, error: 'parse_error', status: res.status };
  }

  const parsed = JsonRpcResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'invalid_jsonrpc' };

  if (parsed.data.error) {
    // Upstream's message is typed + short, but we still want a stable error
    // code on our side — strip to generic code for the caller, let the raw
    // message only into logs via the caller's redactPayload pipeline.
    return { ok: false, error: 'upstream_jsonrpc_error' };
  }

  return { ok: true, result: extractResult(parsed.data.result), latencyMs };
};
