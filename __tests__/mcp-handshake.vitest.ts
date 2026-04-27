import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMcpHandshake } from '@/lib/mcp/handshake';
import { getSafeFetchMock, mockFetch } from '@/__tests__/_helpers/mock-fetch';

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

  it('retries init with the fallback protocol version on a version-mismatch error', async () => {
    const mock = await getSafeFetchMock();
    // Primary 2025-03-26 init: server rejects with a version-mismatch hint.
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          error: { code: -32602, message: "Server's protocol version is not supported" },
        }),
        'application/json',
      ),
    );
    // Fallback 2024-11-05 init: server accepts and issues a session.
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          result: { protocolVersion: '2024-11-05' },
        }),
        'application/json',
        200,
        { 'mcp-session-id': 'sess-fallback-1' },
      ),
    );
    // Spec-mandated notifications/initialized.
    mock.mockResolvedValueOnce(mockFetch('', 'application/json', 202));

    const out = await runMcpHandshake('https://old-strict.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBe('sess-fallback-1');
    expect(mock.mock.calls).toHaveLength(3);

    // Both init calls should carry the protocol version in the body so we can
    // confirm the second pass actually used 2024-11-05.
    const [, primaryInit] = mock.mock.calls[0];
    const [, fallbackInit] = mock.mock.calls[1];
    const primaryBody = JSON.parse((primaryInit as RequestInit).body as string);
    const fallbackBody = JSON.parse((fallbackInit as RequestInit).body as string);
    expect(primaryBody.params.protocolVersion).toBe('2025-03-26');
    expect(fallbackBody.params.protocolVersion).toBe('2024-11-05');
  });

  it('returns sessionId: null when both primary and fallback init fail with version-mismatch', async () => {
    const mock = await getSafeFetchMock();
    const versionMismatch = mockFetch(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        error: { code: -32602, message: 'unsupported protocol version' },
      }),
      'application/json',
    );
    mock.mockResolvedValueOnce(versionMismatch);
    mock.mockResolvedValueOnce(versionMismatch);

    const out = await runMcpHandshake('https://very-old.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBeNull();
    // Two init calls (primary + fallback), no notifications.
    expect(mock.mock.calls).toHaveLength(2);
  });

  it('does not retry init when the JSON-RPC error message is unrelated to protocol version', async () => {
    const mock = await getSafeFetchMock();
    mock.mockResolvedValueOnce(
      mockFetch(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'init',
          error: { code: -32601, message: 'authentication failed' },
        }),
        'application/json',
      ),
    );

    const out = await runMcpHandshake('https://auth-fail.example.com/mcp', baseHeaders);
    expect(out.sessionId).toBeNull();
    // Only the primary init is sent; an unrelated error doesn't trigger
    // the fallback retry — that would be wasted RTT against a broken server.
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
