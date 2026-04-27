import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHandshakeCache, getOrRunHandshake } from '@/lib/mcp/handshake-cache';
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

const queueStrictInit = (
  mock: ReturnType<typeof vi.fn>,
  sessionId: string,
): void => {
  mock.mockResolvedValueOnce(
    mockFetch(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        result: { protocolVersion: '2024-11-05' },
      }),
      'application/json',
      200,
      { 'mcp-session-id': sessionId },
    ),
  );
  // notifications/initialized
  mock.mockResolvedValueOnce(mockFetch('', 'application/json', 202));
};

describe('getOrRunHandshake', () => {
  beforeEach(async () => {
    const m = await getSafeFetchMock();
    m.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  it('reuses one handshake across multiple lookups for the same origin', async () => {
    const mock = await getSafeFetchMock();
    queueStrictInit(mock, 'sess-saga-1');

    const cache = createHandshakeCache();
    const first = await getOrRunHandshake(cache, 'https://strict.example.com/mcp', baseHeaders);
    const second = await getOrRunHandshake(cache, 'https://strict.example.com/mcp', baseHeaders);
    const third = await getOrRunHandshake(cache, 'https://strict.example.com/mcp', baseHeaders);

    expect(first.sessionId).toBe('sess-saga-1');
    expect(second.sessionId).toBe('sess-saga-1');
    expect(third.sessionId).toBe('sess-saga-1');
    // Init + notifications/initialized fire ONCE total even though we called
    // getOrRunHandshake three times; siblings reuse the cached promise.
    expect(mock.mock.calls).toHaveLength(2);
  });

  it('de-dupes concurrent lookups while one handshake is still in flight', async () => {
    const mock = await getSafeFetchMock();
    queueStrictInit(mock, 'sess-concurrent-1');

    const cache = createHandshakeCache();
    // Fire all three before awaiting any — first call kicks off the
    // handshake, second + third should land on the same in-flight promise.
    const [first, second, third] = await Promise.all([
      getOrRunHandshake(cache, 'https://strict.example.com/mcp', baseHeaders),
      getOrRunHandshake(cache, 'https://strict.example.com/mcp', baseHeaders),
      getOrRunHandshake(cache, 'https://strict.example.com/mcp', baseHeaders),
    ]);

    expect(first.sessionId).toBe('sess-concurrent-1');
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(mock.mock.calls).toHaveLength(2);
  });

  it('keeps separate cache entries per origin URL', async () => {
    const mock = await getSafeFetchMock();
    queueStrictInit(mock, 'sess-origin-a');
    queueStrictInit(mock, 'sess-origin-b');

    const cache = createHandshakeCache();
    const a = await getOrRunHandshake(cache, 'https://a.example.com/mcp', baseHeaders);
    const b = await getOrRunHandshake(cache, 'https://b.example.com/mcp', baseHeaders);

    expect(a.sessionId).toBe('sess-origin-a');
    expect(b.sessionId).toBe('sess-origin-b');
    // 2 origins × (init + notifications) = 4 fetches total.
    expect(mock.mock.calls).toHaveLength(4);
  });

  it('caches sessionId:null outcomes too so permissive servers do not re-handshake', async () => {
    const mock = await getSafeFetchMock();
    // Permissive init: 200, no session header, no JSON-RPC error.
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

    const cache = createHandshakeCache();
    const first = await getOrRunHandshake(cache, 'https://permissive.example.com/mcp', baseHeaders);
    const second = await getOrRunHandshake(cache, 'https://permissive.example.com/mcp', baseHeaders);

    expect(first.sessionId).toBeNull();
    expect(second.sessionId).toBeNull();
    // Only one init fetch — the cached null result is reused.
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('propagates SsrfBlockedError on every reuse rather than swallowing it', async () => {
    const { SsrfBlockedError } = await import('@/lib/security/ssrf-guard');
    const mock = await getSafeFetchMock();
    mock.mockRejectedValueOnce(new SsrfBlockedError('private_ip', 'private IP'));

    const cache = createHandshakeCache();
    await expect(
      getOrRunHandshake(cache, 'http://10.0.0.1/mcp', baseHeaders),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    // The second call hits the cached rejected promise — must re-throw, not
    // silently resolve to sessionId: null.
    await expect(
      getOrRunHandshake(cache, 'http://10.0.0.1/mcp', baseHeaders),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    // Underlying handshake is still only invoked once.
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('isolates cache instances - a fresh cache re-handshakes', async () => {
    const mock = await getSafeFetchMock();
    queueStrictInit(mock, 'sess-request-1');
    queueStrictInit(mock, 'sess-request-2');

    const cacheA = createHandshakeCache();
    const cacheB = createHandshakeCache();
    const a = await getOrRunHandshake(cacheA, 'https://strict.example.com/mcp', baseHeaders);
    const b = await getOrRunHandshake(cacheB, 'https://strict.example.com/mcp', baseHeaders);

    expect(a.sessionId).toBe('sess-request-1');
    expect(b.sessionId).toBe('sess-request-2');
    // Each cache drove its own handshake (4 fetches: 2× init+notifications).
    expect(mock.mock.calls).toHaveLength(4);
  });
});
