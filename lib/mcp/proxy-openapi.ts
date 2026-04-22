import { z } from 'zod';
import { decrypt } from '@/lib/crypto/encrypt';
import type { ServerRow, ToolRow } from '@/lib/manifest/cache';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import { createServiceClient } from '@/lib/supabase/service';

// Real OpenAPI HTTP proxy. Replaces the canned dispatcher for tools whose
// server row has transport='openapi'. Responsibilities:
//   - load server row via service-role client (gateway-scope)
//   - decrypt auth_config and inject the correct header
//   - locate the tool's (method, path) from the server's stored openapi_spec
//   - compose URL (path params from args, remaining → query string for GET/
//     DELETE or JSON body for POST/PUT/PATCH)
//   - route via safeFetch so SSRF guard + timeout apply uniformly
//   - retry once on 5xx with 200ms backoff
//   - normalize upstream errors — never leak body text to the caller

const TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = 200;

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
  z.object({
    type: z.literal('basic'),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  z.object({
    type: z.literal('apikey-header'),
    header_name: z.string().min(1),
    header_value: z.string().min(1),
  }),
]);

type AuthConfig = z.infer<typeof AuthConfigSchema>;

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

type OpenApiOperation = { operationId?: string };
type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>;
type StoredOpenApiSpec = { paths?: Record<string, OpenApiPathItem> };

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

export const buildAuthHeaders = (auth: AuthConfig): Record<string, string> => {
  if (auth.type === 'bearer') return { authorization: `Bearer ${auth.token}` };
  if (auth.type === 'basic') {
    const b64 = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
    return { authorization: `Basic ${b64}` };
  }
  if (auth.type === 'apikey-header') return { [auth.header_name.toLowerCase()]: auth.header_value };
  return {};
};

const findOperation = (
  spec: StoredOpenApiSpec,
  toolName: string,
): { method: HttpMethod; path: string } | null => {
  const paths = spec.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      const fallback = `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()}`;
      const opName = op.operationId ?? fallback;
      if (opName === toolName) return { method, path };
    }
  }
  return null;
};

const substitutePath = (path: string, args: Record<string, unknown>): { path: string; used: Set<string> } => {
  const used = new Set<string>();
  const rendered = path.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const value = args[key];
    if (value === undefined || value === null) return match;
    used.add(key);
    return encodeURIComponent(String(value));
  });
  return { path: rendered, used };
};

const composeUrl = (
  baseUrl: string,
  method: HttpMethod,
  opPath: string,
  args: Record<string, unknown>,
): { url: string; body: string | undefined } => {
  const { path, used } = substitutePath(opPath, args);
  const remaining: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (!used.has(k)) remaining[k] = v;
  }

  // `body` carrier from the importer (openApiToTools wraps JSON bodies under
  // `body`). If present on writes, it becomes the JSON body; for reads, ignore.
  const bodyCarrier = remaining.body;
  delete remaining.body;

  const base = baseUrl.replace(/\/+$/, '');
  const relative = path.startsWith('/') ? path : `/${path}`;
  const isWrite = method === 'post' || method === 'put' || method === 'patch';

  if (isWrite) {
    const body = bodyCarrier !== undefined ? JSON.stringify(bodyCarrier) : JSON.stringify(remaining);
    return { url: `${base}${relative}`, body };
  }

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(remaining)) {
    if (v === undefined || v === null) continue;
    query.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const qs = query.toString();
  return { url: qs ? `${base}${relative}?${qs}` : `${base}${relative}`, body: undefined };
};

const parseResponse = async (res: Response): Promise<unknown> => {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (!text) return null;
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
};

type ServerRecord = Pick<ServerRow, 'id' | 'origin_url' | 'openapi_spec' | 'auth_config' | 'transport'>;

const loadServer = async (serverId: string): Promise<ServerRecord | null> => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('servers')
    .select('id, origin_url, openapi_spec, auth_config, transport')
    .eq('id', serverId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ServerRecord;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const proxyOpenApi = async (
  tool: ToolRow,
  args: Record<string, unknown>,
  ctx: ProxyContext,
): Promise<ProxyResult> => {
  const started = performance.now();

  const server = await loadServer(ctx.serverId);
  if (!server) return { ok: false, error: 'server_not_found' };
  if (server.transport !== 'openapi') return { ok: false, error: 'wrong_transport' };
  if (!server.origin_url) return { ok: false, error: 'origin_url_missing' };

  let auth: AuthConfig;
  try {
    auth = decodeAuthConfig(server.auth_config);
  } catch {
    return { ok: false, error: 'auth_decode_failed' };
  }

  const spec = (server.openapi_spec ?? {}) as StoredOpenApiSpec;
  const op = findOperation(spec, tool.name);
  if (!op) return { ok: false, error: 'operation_not_found' };

  const { url, body } = composeUrl(server.origin_url, op.method, op.path, args);

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...buildAuthHeaders(auth),
  };
  if (body !== undefined) headers['content-type'] = 'application/json';

  const init: RequestInit & { timeoutMs?: number } = {
    method: op.method.toUpperCase(),
    headers,
    timeoutMs: TIMEOUT_MS,
  };
  if (body !== undefined) init.body = body;

  const attempt = async (): Promise<Response> => safeFetch(url, init);

  let res: Response;
  try {
    res = await attempt();
    if (res.status >= 500 && res.status < 600) {
      await delay(RETRY_BACKOFF_MS);
      res = await attempt();
    }
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: 'ssrf_blocked' };
    return { ok: false, error: 'network_error' };
  }

  const latencyMs = Math.round(performance.now() - started);

  if (!res.ok) {
    // Drain the body so the socket releases; never expose contents upstream.
    await res.text().catch(() => '');
    return { ok: false, error: 'upstream_error', status: res.status };
  }

  try {
    const result = await parseResponse(res);
    return { ok: true, result, latencyMs };
  } catch {
    return { ok: false, error: 'parse_error', status: res.status };
  }
};
