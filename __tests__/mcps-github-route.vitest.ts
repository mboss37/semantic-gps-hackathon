import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// GitHub's REST API is hard-coded to `https://api.github.com` inside the
// vendor adapter; standing up a local HTTP server and rewriting URLs cleanly
// is tricky because `safeFetch`'s validateUrl would still try to DNS-resolve
// api.github.com. We stub `safeFetch` directly to intercept the call + feed
// canned responses (mirrors the pre-C.6 github-proxy.vitest.ts approach).

const safeFetchMock = vi.fn();

vi.mock('@/lib/security/ssrf-guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/ssrf-guard')>(
    '@/lib/security/ssrf-guard',
  );
  return {
    ...actual,
    safeFetch: (input: string, init?: RequestInit) => safeFetchMock(input, init),
  };
});

import { POST } from '@/app/api/mcps/github/route';

const rpc = (method: string, params?: Record<string, unknown>, id: string | number = 1): Request =>
  new Request('http://localhost/api/mcps/github', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

type JsonRpcResponseBody = {
  jsonrpc: '2.0';
  id: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const parseBody = async (res: Response): Promise<JsonRpcResponseBody> => {
  const text = await res.text();
  return JSON.parse(text) as JsonRpcResponseBody;
};

const mockResponse = ({ status = 200, body }: { status?: number; body: unknown }): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body !== undefined ? JSON.stringify(body) : ''),
  }) as unknown as Response;

const ORIGINAL_GITHUB_PAT = process.env.GITHUB_PAT;

describe('POST /api/mcps/github', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.GITHUB_PAT = 'ghp_test_fake_pat';
  });

  afterAll(() => {
    if (ORIGINAL_GITHUB_PAT === undefined) delete process.env.GITHUB_PAT;
    else process.env.GITHUB_PAT = ORIGINAL_GITHUB_PAT;
  });

  beforeEach(() => {
    safeFetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tools/list returns all 4 curated GitHub tools', async () => {
    const res = await POST(rpc('tools/list'));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.error).toBeUndefined();
    const result = body.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((t) => t.name).sort()).toEqual([
      'add_comment',
      'close_issue',
      'create_issue',
      'search_issues',
    ]);
  });

  it('tools/call search_issues projects the items shape', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 200,
        body: {
          total_count: 1,
          items: [
            {
              number: 42,
              title: 'Test issue',
              state: 'open',
              html_url: 'https://github.com/foo/bar/issues/42',
              user: { login: 'alice' },
              created_at: '2026-04-20T10:00:00Z',
              body: 'ignored',
            },
          ],
        },
      }),
    );
    const res = await POST(
      rpc('tools/call', {
        name: 'search_issues',
        arguments: { query: 'repo:foo/bar is:open', limit: 5 },
      }),
    );
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.error).toBeUndefined();
    const result = body.result as { content: Array<{ type: string; text: string }> };
    const inner = JSON.parse(result.content[0].text) as {
      total_count: number;
      items: Array<Record<string, unknown>>;
    };
    expect(inner.total_count).toBe(1);
    expect(inner.items[0]).toEqual({
      number: 42,
      title: 'Test issue',
      state: 'open',
      html_url: 'https://github.com/foo/bar/issues/42',
      user_login: 'alice',
      created_at: '2026-04-20T10:00:00Z',
    });
    const [url, init] = safeFetchMock.mock.calls[0];
    expect(url).toContain('https://api.github.com/search/issues');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe('Bearer ghp_test_fake_pat');
    expect(headers['user-agent']).toBe('semantic-gps-gateway');
  });

  it('unknown method returns -32601', async () => {
    const res = await POST(rpc('bogus/method'));
    const body = await parseBody(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('tools/call create_issue with invalid owner rejects before fetch', async () => {
    const res = await POST(
      rpc('tools/call', {
        name: 'create_issue',
        arguments: { owner: 'foo/bar', repo: 'baz', title: 'x' },
      }),
    );
    const body = await parseBody(res);
    expect(body.error?.code).toBe(-32000);
    const data = body.error?.data as { reason?: string } | undefined;
    expect(data?.reason).toBe('invalid_input');
    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});
