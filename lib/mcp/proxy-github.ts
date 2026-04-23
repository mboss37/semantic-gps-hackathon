import { z } from 'zod';
import type { ToolRow } from '@/lib/manifest/cache';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import {
  decodeGithubAuthConfig,
  loadServer,
  TIMEOUT_MS,
  UpstreamError,
  type GithubAuthConfig,
} from '@/lib/mcp/github-auth';

// Re-export auth surface so external callers (tool-dispatcher, tests,
// register-github) keep a single import path.
export { type GithubAuthConfig } from '@/lib/mcp/github-auth';

// GitHub proxy — hand-authored mapping from 4 curated MCP tools onto the
// REST v3 API. PAT auth (Bearer) only; no token cache because PATs don't
// auto-refresh. Same ProxyResult contract as proxy-openapi / proxy-http /
// proxy-salesforce / proxy-slack so the dispatcher switch routes without
// special casing.

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'semantic-gps-gateway';

export type ProxyOk = { ok: true; result: unknown; latencyMs: number };
export type ProxyErr = { ok: false; error: string; status?: number };
export type ProxyResult = ProxyOk | ProxyErr;

export type ProxyContext = {
  serverId: string;
  traceId: string;
};

type CallInit = {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
};

// Generic GitHub REST call. User-Agent is non-optional — missing it returns
// 403 from api.github.com. Response bodies are JSON; we parse then surface
// via `body.message` on non-2xx so callers get actionable detail.
const ghCall = async (
  auth: GithubAuthConfig,
  call: CallInit,
): Promise<{ body: unknown }> => {
  const url = `${GITHUB_API_BASE}${call.path}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${auth.pat}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': GITHUB_API_VERSION,
    'user-agent': USER_AGENT,
  };
  const init: RequestInit & { timeoutMs?: number } = {
    method: call.method,
    headers,
    timeoutMs: TIMEOUT_MS,
  };
  if (call.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(call.body);
  }

  let res: Response;
  try {
    res = await safeFetch(url, init);
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new UpstreamError(502, 'network_error');
  }

  const text = await res.text();

  if (!res.ok) {
    let detail: string | undefined;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && 'message' in parsed) {
          const msg = (parsed as { message?: unknown }).message;
          if (typeof msg === 'string') detail = msg;
        }
      } catch {
        // non-json body, ignore
      }
    }
    if (res.status === 401 || res.status === 403) {
      throw new UpstreamError(res.status, 'upstream_auth_failed', detail);
    }
    if (res.status === 404) {
      throw new UpstreamError(404, 'origin_error', 'not found');
    }
    throw new UpstreamError(res.status, 'origin_error', detail ?? (text ? text.slice(0, 200) : undefined));
  }

  if (!text) return { body: null };
  try {
    return { body: JSON.parse(text) };
  } catch {
    throw new UpstreamError(502, 'parse_error');
  }
};

// Per-tool input schemas. Enforced locally so we never hit GitHub with
// malformed input. Errors here become `invalid_input` before any fetch.
// Owner regex: GitHub username/org rules (alnum + hyphens, no leading hyphen,
// max 39 chars). Repo regex: alnum + dot/dash/underscore, max 100 chars.
const OwnerRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/;
const RepoRegex = /^[a-zA-Z0-9._-]{1,100}$/;

const SearchIssuesArgs = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).optional(),
});

const CreateIssueArgs = z.object({
  owner: z.string().regex(OwnerRegex),
  repo: z.string().regex(RepoRegex),
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string().min(1).max(100)).max(20).optional(),
});

const AddCommentArgs = z.object({
  owner: z.string().regex(OwnerRegex),
  repo: z.string().regex(RepoRegex),
  issue_number: z.number().int().positive(),
  body: z.string().min(1).max(65536),
});

const CloseIssueArgs = z.object({
  owner: z.string().regex(OwnerRegex),
  repo: z.string().regex(RepoRegex),
  issue_number: z.number().int().positive(),
});

// Response projections. GitHub payloads are verbose; we trim them down to the
// demo-relevant fields so agent context stays tight.
type IssueProjection = {
  number: number | null;
  title: string | null;
  state: string | null;
  html_url: string | null;
  user_login: string | null;
  created_at: string | null;
};

const projectSearchItem = (raw: unknown): IssueProjection => {
  const row = (raw ?? {}) as Record<string, unknown>;
  const user = (row.user ?? null) as Record<string, unknown> | null;
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  return {
    number: num(row.number),
    title: str(row.title),
    state: str(row.state),
    html_url: str(row.html_url),
    user_login: user ? str(user.login) : null,
    created_at: str(row.created_at),
  };
};

const dispatchTool = async (
  auth: GithubAuthConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  if (toolName === 'search_issues') {
    const parsed = SearchIssuesArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const perPage = parsed.data.limit ?? 10;
    const qs = `?q=${encodeURIComponent(parsed.data.query)}&per_page=${perPage}`;
    const { body } = await ghCall(auth, { method: 'GET', path: `/search/issues${qs}` });
    const root = (body ?? {}) as Record<string, unknown>;
    const total = typeof root.total_count === 'number' ? root.total_count : 0;
    const itemsRaw = Array.isArray(root.items) ? root.items : [];
    return { total_count: total, items: itemsRaw.map(projectSearchItem) };
  }

  if (toolName === 'create_issue') {
    const parsed = CreateIssueArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const payload: Record<string, unknown> = { title: parsed.data.title };
    if (parsed.data.body !== undefined) payload.body = parsed.data.body;
    if (parsed.data.labels !== undefined) payload.labels = parsed.data.labels;
    const { body } = await ghCall(auth, {
      method: 'POST',
      path: `/repos/${parsed.data.owner}/${parsed.data.repo}/issues`,
      body: payload,
    });
    const row = (body ?? {}) as Record<string, unknown>;
    return {
      number: typeof row.number === 'number' ? row.number : null,
      html_url: typeof row.html_url === 'string' ? row.html_url : null,
      state: typeof row.state === 'string' ? row.state : null,
    };
  }

  if (toolName === 'add_comment') {
    const parsed = AddCommentArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await ghCall(auth, {
      method: 'POST',
      path: `/repos/${parsed.data.owner}/${parsed.data.repo}/issues/${parsed.data.issue_number}/comments`,
      body: { body: parsed.data.body },
    });
    const row = (body ?? {}) as Record<string, unknown>;
    return {
      id: typeof row.id === 'number' ? row.id : null,
      html_url: typeof row.html_url === 'string' ? row.html_url : null,
    };
  }

  if (toolName === 'close_issue') {
    const parsed = CloseIssueArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await ghCall(auth, {
      method: 'PATCH',
      path: `/repos/${parsed.data.owner}/${parsed.data.repo}/issues/${parsed.data.issue_number}`,
      body: { state: 'closed' },
    });
    const row = (body ?? {}) as Record<string, unknown>;
    return {
      number: typeof row.number === 'number' ? row.number : null,
      state: typeof row.state === 'string' ? row.state : null,
      html_url: typeof row.html_url === 'string' ? row.html_url : null,
    };
  }

  throw new UpstreamError(400, 'unknown_tool');
};

// Public entry point for `tool-dispatcher.ts`. Same `ProxyResult` contract as
// the OpenAPI + HTTP-streamable + Salesforce + Slack proxies so the dispatcher
// transport switch stays uniform.
export const proxyGithub = async (
  tool: ToolRow,
  args: Record<string, unknown>,
  ctx: ProxyContext,
): Promise<ProxyResult> => {
  const started = performance.now();

  const server = await loadServer(ctx.serverId);
  if (!server) return { ok: false, error: 'server_not_found' };
  if (server.transport !== 'github') return { ok: false, error: 'wrong_transport' };

  let auth: GithubAuthConfig | null;
  try {
    auth = decodeGithubAuthConfig(server.auth_config);
  } catch {
    return { ok: false, error: 'auth_decode_failed' };
  }
  if (!auth) return { ok: false, error: 'auth_decode_failed' };

  try {
    const result = await dispatchTool(auth, tool.name, args);
    const latencyMs = Math.round(performance.now() - started);
    return { ok: true, result, latencyMs };
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: 'ssrf_blocked' };
    if (e instanceof UpstreamError) {
      return { ok: false, error: e.reason, status: e.status };
    }
    return { ok: false, error: 'network_error' };
  }
};
