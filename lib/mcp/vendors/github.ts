import { z } from 'zod';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import { VendorError } from '@/lib/mcp/vendors/errors';

// GitHub MCP vendor seam. Owns PAT-authed REST dispatch for the 4 curated GH
// tools. `GITHUB_PAT` comes from the env var — classic + fine-grained PATs
// don't auto-refresh so there is no token cache. Colocated with the gateway
// today; extraction to a standalone deploy is a zero-gateway-change refactor.

const TIMEOUT_MS = 10_000;
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'semantic-gps-gateway';

const loadPat = (): string | null => {
  const pat = process.env.GITHUB_PAT ?? '';
  return pat || null;
};

type CallInit = {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
};

// GitHub REST call. User-Agent is non-optional — missing it returns 403.
// 401/403 surface as upstream_auth_failed; 404 as origin_error("not found");
// other non-2xx as origin_error with body.message detail when present.
const ghCall = async (pat: string, call: CallInit): Promise<{ body: unknown }> => {
  const url = `${GITHUB_API_BASE}${call.path}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${pat}`,
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
    throw new VendorError(502, 'network_error');
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
      throw new VendorError(res.status, 'upstream_auth_failed', detail);
    }
    if (res.status === 404) throw new VendorError(404, 'origin_error', 'not found');
    throw new VendorError(res.status, 'origin_error', detail ?? (text ? text.slice(0, 200) : undefined));
  }

  if (!text) return { body: null };
  try {
    return { body: JSON.parse(text) };
  } catch {
    throw new VendorError(502, 'parse_error');
  }
};

// Per-tool input schemas.
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

export const GITHUB_TOOLS = [
  {
    name: 'search_issues',
    description: 'Search GitHub issues and PRs by query string.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        query: { type: 'string', minLength: 1, maxLength: 500 },
      },
    },
  },
  {
    name: 'create_issue',
    description: 'Create a new GitHub issue on a repo.',
    inputSchema: {
      type: 'object',
      required: ['owner', 'repo', 'title'],
      properties: {
        body: { type: 'string', maxLength: 65536 },
        repo: { type: 'string' },
        owner: { type: 'string' },
        title: { type: 'string', minLength: 1, maxLength: 256 },
        labels: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to an existing GitHub issue.',
    inputSchema: {
      type: 'object',
      required: ['owner', 'repo', 'issue_number', 'body'],
      properties: {
        body: { type: 'string', minLength: 1, maxLength: 65536 },
        repo: { type: 'string' },
        owner: { type: 'string' },
        issue_number: { type: 'integer', minimum: 1 },
      },
    },
  },
  {
    name: 'close_issue',
    description: 'Close an existing GitHub issue.',
    inputSchema: {
      type: 'object',
      required: ['owner', 'repo', 'issue_number'],
      properties: {
        repo: { type: 'string' },
        owner: { type: 'string' },
        issue_number: { type: 'integer', minimum: 1 },
      },
    },
  },
] as const;

export const dispatchGithubTool = async (
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const pat = loadPat();
  if (!pat) throw new VendorError(500, 'credentials_missing');

  if (toolName === 'search_issues') {
    const parsed = SearchIssuesArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const perPage = parsed.data.limit ?? 10;
    const qs = `?q=${encodeURIComponent(parsed.data.query)}&per_page=${perPage}`;
    const { body } = await ghCall(pat, { method: 'GET', path: `/search/issues${qs}` });
    const root = (body ?? {}) as Record<string, unknown>;
    const total = typeof root.total_count === 'number' ? root.total_count : 0;
    const itemsRaw = Array.isArray(root.items) ? root.items : [];
    return { total_count: total, items: itemsRaw.map(projectSearchItem) };
  }

  if (toolName === 'create_issue') {
    const parsed = CreateIssueArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const payload: Record<string, unknown> = { title: parsed.data.title };
    if (parsed.data.body !== undefined) payload.body = parsed.data.body;
    if (parsed.data.labels !== undefined) payload.labels = parsed.data.labels;
    const { body } = await ghCall(pat, {
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
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await ghCall(pat, {
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
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await ghCall(pat, {
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

  throw new VendorError(400, 'unknown_tool');
};
