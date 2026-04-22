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

const mockFetch = (body: BodyInit, contentType: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
  text: () => Promise.resolve(typeof body === 'string' ? body : ''),
});

type SafeFetchMock = ReturnType<typeof vi.fn>;

const getSafeFetchMock = async (): Promise<SafeFetchMock> => {
  const mod = await import('@/lib/security/ssrf-guard');
  return mod.safeFetch as unknown as SafeFetchMock;
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
    mock.mockResolvedValueOnce(mockFetch(sseBody, 'text/event-stream'));

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tools).toEqual([{ name: 'echo', inputSchema: { type: 'object' } }]);
  });

  it('sends Bearer header when auth is bearer', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(
      mockFetch(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }), 'application/json'),
    );

    await discoverTools('https://example.com/mcp', { type: 'bearer', token: 'sk-test' });
    const [, init] = mock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer sk-test' });
  });

  it('reports origin HTTP errors', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 502));

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/HTTP 502/);
  });

  it('reports JSON-RPC errors from origin', async () => {
    const mock = await getSafeFetchMock();
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
    mock.mockResolvedValueOnce(mockFetch(JSON.stringify({ hello: 'world' }), 'application/json'));

    const result = await discoverTools('https://example.com/mcp', { type: 'none' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid MCP/);
  });
});
