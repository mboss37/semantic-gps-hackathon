import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { discoverTools } from '@/lib/mcp/discover-tools';
import { getSafeFetchMock, mockFetch, queuePermissiveInit } from '@/__tests__/_helpers/mock-fetch';

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

describe('discoverTools', () => {
  // Default to permissive init for every test. Strict-server tests below
  // bypass this by calling `m.mockReset()` to clear the queued init and
  // queuing their own three-call sequence (init + notifications +
  // tools/list). Hoisting eliminates the foot-gun where a new test author
  // copy-pastes a case and forgets to queue init, getting a confusing
  // "tools/list got the init mock instead" failure mode.
  beforeEach(async () => {
    const m = await getSafeFetchMock();
    m.mockReset();
    queuePermissiveInit(m);
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

  it('forwards the captured mcp-session-id on tools/list when the upstream issues one', async () => {
    const mock = await getSafeFetchMock();
    // Strict-server case: clear the permissive init beforeEach queued so we
    // can stage the full 3-step lifecycle (init + notifications + tools/list)
    // explicitly. The reset still leaves vi mocking active.
    mock.mockReset();
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
