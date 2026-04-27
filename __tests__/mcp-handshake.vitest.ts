import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runMcpHandshake } from '@/lib/mcp/handshake';

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
  body: string,
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
    text: () => Promise.resolve(body),
  };
};

type SafeFetchMock = ReturnType<typeof vi.fn>;

const getSafeFetchMock = async (): Promise<SafeFetchMock> => {
  const mod = await import('@/lib/security/ssrf-guard');
  return mod.safeFetch as unknown as SafeFetchMock;
};

const baseHeaders = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

describe('runMcpHandshake', () => {
  beforeEach(async () => {
    const m = await getSafeFetchMock();
    m.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('captures the mcp-session-id from a strict server and fires notifications/initialized', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          result: { protocolVersion: '2024-11-05' },
        }),
        'application/json',
        200,
        { 'mcp-session-id': 'sess-strict-1' },
      ),
    );
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 202));

    const out = await runMcpHandshake('https://strict.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBe('sess-strict-1');
    expect(mock.mock.calls).toHaveLength(2);

    // notifications/initialized should carry the session id, the body is the
    // spec-shaped notification with no `id` field.
    const [, notifyInit] = mock.mock.calls[1];
    expect((notifyInit as RequestInit).headers).toMatchObject({
      'mcp-session-id': 'sess-strict-1',
    });
    const notifyBody = JSON.parse(((notifyInit as RequestInit).body as string) ?? '{}');
    expect(notifyBody.method).toBe('notifications/initialized');
    expect(notifyBody.id).toBeUndefined();
  });

  it('returns sessionId: null when the server does not issue an mcp-session-id header', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          result: { protocolVersion: '2025-03-26' },
        }),
        'application/json',
      ),
    );

    const out = await runMcpHandshake('https://permissive.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBeNull();
    // No notifications/initialized when there is nothing to scope it to.
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('treats a JSON-RPC error on initialize as no-handshake and returns sessionId: null', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          error: { code: -32601, message: 'method not found' },
        }),
        'application/json',
        200,
        { 'mcp-session-id': 'sess-should-be-ignored' },
      ),
    );

    const out = await runMcpHandshake('https://no-init.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBeNull();
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('returns sessionId: null on HTTP 5xx without throwing', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 503));

    const out = await runMcpHandshake('https://broken.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBeNull();
  });

  it('returns sessionId: null on a network error without throwing', async () => {
    const mock = await getSafeFetchMock();
    mock.mockRejectedValueOnce(new Error('econnreset'));

    const out = await runMcpHandshake('https://drop.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBeNull();
  });

  it('propagates SsrfBlockedError from the initialize call', async () => {
    const { SsrfBlockedError } = await import('@/lib/security/ssrf-guard');
    const mock = await getSafeFetchMock();
    mock.mockRejectedValueOnce(new SsrfBlockedError('private_ip', 'private IP'));

    await expect(
      runMcpHandshake('http://192.168.1.1/mcp', baseHeaders),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('parses an SSE-shaped initialize response body', async () => {
    const mock = await getSafeFetchMock();
    const sseBody = `event: message\ndata: ${JSON.stringify({
      jsonrpc: '2.0',
      id: 'init',
      result: { protocolVersion: '2024-11-05' },
    })}\n\n`;
    mock.mockResolvedValueOnce(
      mockFetch(sseBody, 'text/event-stream', 200, { 'mcp-session-id': 'sess-sse-1' }),
    );
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 202));

    const out = await runMcpHandshake('https://sse.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBe('sess-sse-1');
  });

  it('forwards baseHeaders (e.g. Authorization) on the initialize call so strict servers authenticate the handshake itself', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({ jsonrpc: '2.0', id: 'init', result: {} }),
        'application/json',
      ),
    );

    await runMcpHandshake('https://gated.example.com/mcp', {
      ...baseHeaders,
      authorization: 'Bearer ht_live_demo',
    });

    const [, init] = mock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      authorization: 'Bearer ht_live_demo',
    });
  });
});
