import type { vi } from 'vitest';

// Shared `safeFetch` mock helpers for handshake + discovery + proxy tests.
// All three test files were maintaining their own copy; extracting keeps
// response-shape changes (e.g. when the gateway grows another header) to
// one diff site.

type ResponseHeaders = Record<string, string>;

export type SafeFetchMock = ReturnType<typeof vi.fn>;

export type MockResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

// Build a fetch-like response object minimally compatible with what the
// callers under test read: `ok`, `status`, header `.get(name)`, and
// `.text()`. Additional fields can be added as new callers need them.
export const mockFetch = (
  body: BodyInit | string,
  contentType: string,
  status = 200,
  extraHeaders: ResponseHeaders = {},
): MockResponse => {
  const headers: ResponseHeaders = { 'content-type': contentType, ...extraHeaders };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
  };
};

export const getSafeFetchMock = async (): Promise<SafeFetchMock> => {
  const mod = await import('@/lib/security/ssrf-guard');
  return mod.safeFetch as unknown as SafeFetchMock;
};

// Queue a permissive `initialize` response: 200 OK, no `mcp-session-id`
// header, no JSON-RPC error. The handshake returns sessionId: null and the
// caller falls through to a direct call. Mirrors how our in-process vendor
// MCPs (Salesforce / Slack / GitHub) behave today.
export const queuePermissiveInit = (mock: SafeFetchMock): void => {
  mock.mockResolvedValueOnce(
    mockFetch(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        result: { protocolVersion: '2025-03-26', capabilities: {} },
      }),
      'application/json',
    ),
  );
};
