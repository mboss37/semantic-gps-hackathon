import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverTools } from '@/lib/mcp/discover-tools';

// safeFetch is SSRF-guarded; stub it out so tests don't need DNS.
vi.mock('@/lib/security/ssrf-guard', () => ({
  safeFetch: vi.fn(),
  SsrfBlockedError: class SsrfBlockedError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

type ResponseHeaders = Record<string, string>;

const mockFetch = (
  body: BodyInit,
  contentType: string,
  status = 200,
  extraHeaders: ResponseHeaders = {},
) => {
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

type SafeFetchMock = ReturnType<typeof vi.fn>;

const getSafeFetchMock = async (): Promise<SafeFetchMock> => {
  const mod = await import('@/lib/security/ssrf-guard');
  return mod.safeFetch as unknown as SafeFetchMock;
};

// Queue a permissive `initialize` response: 200 OK, no `mcp-session-id`
// header, body has no JSON-RPC error. The handshake returns sessionId: null
// and the caller falls through to a direct tools/list call, mirroring how
// our in-process vendor MCPs behave today.
const queuePermissiveInit = (mock: SafeFetchMock): void => {
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

describe('discoverTools', () => {
  beforeEach(async () => {
    const m = await getSafeFetchMock();
    m.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns tools from a plain JSON tools/list response', async () => {
    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            tools: [
              { name: 'search', description: 'Search things', inputSchema: { type: 'object' } },
              { name: 'fetch', inputSchema: { type: 'object' } },
            ],
          },
        }),
        'application/json',
      ),
    );

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe('search');
    }
  });

  it('parses a single-event SSE response body', async () => {
    const sseBody = `data: ${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [{ name: 'echo', inputSchema: { type: 'object' } }] },
    })}\n\n`;

    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(mockFetch(sseBody, 'text/event-stream'));

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tools).toEqual([{ name: 'echo', inputSchema: { type: 'object' } }]);
  });

  it('sends Bearer header when auth is bearer', async () => {
    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(
      mockFetch(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }), 'application/json'),
    );

    await discoverTools('https://example.com/mcp', { type: 'bearer', token: 'sk-test' });
    // Init call is mock.mock.calls[0]; tools/list is mock.mock.calls[1]. Both
    // must carry the bearer so strict servers that authenticate the init
    // handshake itself (Mule charges auth on every method) pass through.
    const [, initInit] = mock.mock.calls[0];
    const [, listInit] = mock.mock.calls[1];
    expect((initInit as RequestInit).headers).toMatchObject({ authorization: 'Bearer sk-test' });
    expect((listInit as RequestInit).headers).toMatchObject({ authorization: 'Bearer sk-test' });
  });

  it('reports origin HTTP errors', async () => {
    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 502));

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/HTTP 502/);
  });

  it('reports JSON-RPC errors from origin', async () => {
    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'method not found' } }),
        'application/json',
      ),
    );

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/method not found/);
  });

  it('rejects responses that are not valid MCP shape', async () => {
    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(mockFetch(JSON.stringify({ hello: 'world' }), 'application/json'));

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid MCP/);
  });

  it('forwards the captured mcp-session-id on tools/list when the upstream issues one', async () => {
    const mock = await getSafeFetchMock();
    // Init returns 200 + session id header + initialize result + sets up
    // the strict-server lifecycle that Mule and spec-aligned SDKs enforce.
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          result: { protocolVersion: '2024-11-05', capabilities: {} },
        }),
        'application/json',
        200,
        { 'mcp-session-id': 'sess-abc-123' },
      ),
    );
    // Spec-mandated notifications/initialized.
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 202));
    // Real tools/list — gated on the session id.
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { tools: [{ name: 'submit_order', inputSchema: { type: 'object' } }] },
        }),
        'application/json',
      ),
    );

    const result = await discoverTools('https://strict.example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tools[0].name).toBe('submit_order');

    // 3 calls total: init + notifications/initialized + tools/list.
    expect(mock.mock.calls).toHaveLength(3);
    const [, notifyInit] = mock.mock.calls[1];
    const [, listInit] = mock.mock.calls[2];
    expect((notifyInit as RequestInit).headers).toMatchObject({ 'mcp-session-id': 'sess-abc-123' });
    expect((listInit as RequestInit).headers).toMatchObject({ 'mcp-session-id': 'sess-abc-123' });
  });

  it('skips the session header when the upstream does not issue one', async () => {
    const mock = await getSafeFetchMock();
    queuePermissiveInit(mock);
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }),
        'application/json',
      ),
    );

    await discoverTools('https://permissive.example.com/mcp', { type: 'none' });
    expect(mock.mock.calls).toHaveLength(2);
    const [, listInit] = mock.mock.calls[1];
    expect((listInit as RequestInit).headers).not.toHaveProperty('mcp-session-id');
  });
});
