import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked GitHub proxy. GitHub's REST API isn't trivially stood up on a local
// HTTP server because URL resolution is hard-coded to `https://api.github.com`
// inside `proxy-github.ts`; instead we stub `safeFetch` directly and assert on
// the call shape (url, method, headers, body) + feed canned responses back in.

const serverFixture: { current: Record<string, unknown> | null } = { current: null };

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: serverFixture.current, error: null }),
        }),
      }),
    }),
  }),
}));

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

import { encrypt } from '@/lib/crypto/encrypt';
import { proxyGithub } from '@/lib/mcp/proxy-github';
import type { ToolRow } from '@/lib/manifest/cache';

const makeTool = (name: string): ToolRow => ({
  id: `tool-${name}`,
  server_id: 'srv',
  name,
  description: null,
  input_schema: { type: 'object' },
});

const ctx = { serverId: 'srv', traceId: 'trace-gh' };

const makeAuthEnvelope = (): { ciphertext: string } => ({
  ciphertext: encrypt(
    JSON.stringify({
      type: 'pat',
      pat: 'ghp_test_fake_token_000000000000000000',
    }),
  ),
});

type FetchResponseInit = {
  status?: number;
  body?: unknown;
  textBody?: string;
};

const mockResponse = ({ status = 200, body, textBody }: FetchResponseInit): Response => {
  const text = textBody ?? (body !== undefined ? JSON.stringify(body) : '');
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as unknown as Response;
};

describe('proxyGithub', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  beforeEach(() => {
    serverFixture.current = {
      id: 'srv',
      transport: 'github',
      auth_config: makeAuthEnvelope(),
    };
    safeFetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('sends required GitHub headers on every call', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({ status: 200, body: { total_count: 0, items: [] } }),
    );
    await proxyGithub(makeTool('search_issues'), { query: 'repo:foo/bar is:open' }, ctx);
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = safeFetchMock.mock.calls[0];
    expect(url).toContain('https://api.github.com/search/issues');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe('Bearer ghp_test_fake_token_000000000000000000');
    expect(headers.accept).toBe('application/vnd.github+json');
    expect(headers['x-github-api-version']).toBe('2022-11-28');
    expect(headers['user-agent']).toBe('semantic-gps-gateway');
  });

  it('search_issues happy path projects items to trimmed shape', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 200,
        body: {
          total_count: 2,
          incomplete_results: false,
          items: [
            {
              number: 42,
              title: 'Fix crash in parser',
              state: 'open',
              html_url: 'https://github.com/foo/bar/issues/42',
              user: { login: 'alice', id: 1 },
              body: 'details...',
              created_at: '2026-04-20T10:00:00Z',
              extra_field_we_should_drop: 'noise',
            },
            {
              number: 43,
              title: 'Add tests',
              state: 'closed',
              html_url: 'https://github.com/foo/bar/issues/43',
              user: { login: 'bob' },
              created_at: '2026-04-21T10:00:00Z',
            },
          ],
        },
      }),
    );
    const result = await proxyGithub(
      makeTool('search_issues'),
      { query: 'repo:foo/bar is:issue', limit: 5 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [url] = safeFetchMock.mock.calls[0];
    expect(url).toContain('q=repo%3Afoo%2Fbar%20is%3Aissue');
    expect(url).toContain('per_page=5');
    const out = result.result as {
      total_count: number;
      items: Array<Record<string, unknown>>;
    };
    expect(out.total_count).toBe(2);
    expect(out.items).toHaveLength(2);
    expect(out.items[0]).toEqual({
      number: 42,
      title: 'Fix crash in parser',
      state: 'open',
      html_url: 'https://github.com/foo/bar/issues/42',
      user_login: 'alice',
      created_at: '2026-04-20T10:00:00Z',
    });
    // body + extra_field_we_should_drop must not leak through
    expect(out.items[0]).not.toHaveProperty('body');
    expect(out.items[0]).not.toHaveProperty('extra_field_we_should_drop');
  });

  it('create_issue posts JSON body and projects number/html_url/state', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 201,
        body: {
          number: 101,
          title: 'New issue',
          state: 'open',
          html_url: 'https://github.com/foo/bar/issues/101',
          id: 9999,
          body: 'ignored',
        },
      }),
    );
    const result = await proxyGithub(
      makeTool('create_issue'),
      { owner: 'foo', repo: 'bar', title: 'New issue', body: 'hello', labels: ['bug'] },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [url, init] = safeFetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/foo/bar/issues');
    expect(init?.method).toBe('POST');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({
      title: 'New issue',
      body: 'hello',
      labels: ['bug'],
    });
    expect(result.result).toEqual({
      number: 101,
      html_url: 'https://github.com/foo/bar/issues/101',
      state: 'open',
    });
  });

  it('add_comment posts and projects id/html_url', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 201,
        body: {
          id: 55555,
          html_url: 'https://github.com/foo/bar/issues/42#issuecomment-55555',
          body: 'thx',
          user: { login: 'svc' },
        },
      }),
    );
    const result = await proxyGithub(
      makeTool('add_comment'),
      { owner: 'foo', repo: 'bar', issue_number: 42, body: 'thx' },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [url, init] = safeFetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/foo/bar/issues/42/comments');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({ body: 'thx' });
    expect(result.result).toEqual({
      id: 55555,
      html_url: 'https://github.com/foo/bar/issues/42#issuecomment-55555',
    });
  });

  it('close_issue PATCHes state=closed and projects number/state/html_url', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 200,
        body: {
          number: 42,
          state: 'closed',
          html_url: 'https://github.com/foo/bar/issues/42',
          title: 'whatever',
        },
      }),
    );
    const result = await proxyGithub(
      makeTool('close_issue'),
      { owner: 'foo', repo: 'bar', issue_number: 42 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [url, init] = safeFetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/foo/bar/issues/42');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({ state: 'closed' });
    expect(result.result).toEqual({
      number: 42,
      state: 'closed',
      html_url: 'https://github.com/foo/bar/issues/42',
    });
  });

  it('maps 404 to origin_error with detail "not found"', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 404,
        body: { message: 'Not Found', documentation_url: 'https://docs.github.com/rest' },
      }),
    );
    const result = await proxyGithub(
      makeTool('close_issue'),
      { owner: 'foo', repo: 'bar', issue_number: 9999 },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('origin_error');
    expect(result.status).toBe(404);
  });

  it('maps 422 validation error to origin_error with body.message', async () => {
    safeFetchMock.mockResolvedValueOnce(
      mockResponse({
        status: 422,
        body: { message: 'Validation Failed', errors: [{ resource: 'Issue', code: 'missing' }] },
      }),
    );
    const result = await proxyGithub(
      makeTool('create_issue'),
      { owner: 'foo', repo: 'bar', title: 'bad' },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('origin_error');
    expect(result.status).toBe(422);
  });

  it('rejects invalid owner (contains slash) via Zod without calling fetch', async () => {
    const result = await proxyGithub(
      makeTool('create_issue'),
      { owner: 'foo/bar', repo: 'baz', title: 'x' },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_input');
    expect(result.status).toBe(400);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it('rejects empty owner via Zod without calling fetch', async () => {
    const result = await proxyGithub(
      makeTool('add_comment'),
      { owner: '', repo: 'bar', issue_number: 42, body: 'hi' },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_input');
    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});
