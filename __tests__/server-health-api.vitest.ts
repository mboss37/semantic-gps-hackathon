import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 14 WP-14.2: origin health probe API.
// Same hoisted-mock pattern as policy-timeline-api.vitest.ts — stubs
// `requireAuth` so no real cookies needed, stubs `safeFetch` + exports
// `SsrfBlockedError` from the ssrf-guard module, and hands the route an
// in-memory Supabase stub that returns the lone `servers` row under test.
//
// Coverage:
//   1. HEAD 2xx → ok (classifyStatus 200-399 range).
//   2. HEAD + GET both 4xx → degraded (GET fallback fires, keeps 404).
//   3. Both attempts throw SsrfBlockedError → down + reason='ssrf_blocked'.
//   4. Both attempts throw AbortError-like timeout → down + reason='timeout'.

const { requireAuthMock, safeFetchMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  safeFetchMock: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    requireAuth: requireAuthMock,
  };
});

// Keep `SsrfBlockedError` as the REAL class so `instanceof` checks inside
// the route still pass — just swap `safeFetch` for the mock.
vi.mock('@/lib/security/ssrf-guard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/ssrf-guard')>(
    '@/lib/security/ssrf-guard',
  );
  return {
    ...actual,
    safeFetch: safeFetchMock,
  };
});

const SERVER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_SERVER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_ID = 'org-test';

type ServerRow = { id: string; origin_url: string | null; organization_id: string };

const makeStubSupabase = (row: ServerRow | null) => ({
  from: (table: string) => {
    if (table !== 'servers') throw new Error(`unexpected table: ${table}`);
    return {
      select: (_cols: string) => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: row && row.id === value ? row : null,
              error: null,
            }),
        }),
      }),
    };
  },
});

const makeAuthResult = (supabase: ReturnType<typeof makeStubSupabase>) => ({
  user: { id: 'u1' },
  supabase,
  organization_id: ORG_ID,
  role: 'admin' as const,
});

const makeRequest = (id: string): Request =>
  new Request(`http://localhost/api/servers/${id}/health`);

// Build a Response-shaped object that the route's `.status` classifier reads.
const mockHttpResponse = (status: number) =>
  ({ status, ok: status >= 200 && status < 300 } as unknown as Response);

const { GET } = await import('@/app/api/servers/[id]/health/route');

describe('origin health probe API (WP-14.2)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    safeFetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('HEAD 200 → ok with statusCode + latency', async () => {
    const row: ServerRow = {
      id: SERVER_ID,
      origin_url: 'https://example.com/mcp',
      organization_id: ORG_ID,
    };
    const stub = makeStubSupabase(row);
    requireAuthMock.mockResolvedValue(makeAuthResult(stub));
    safeFetchMock.mockResolvedValueOnce(mockHttpResponse(200));

    const res = await GET(makeRequest(SERVER_ID), {
      params: Promise.resolve({ id: SERVER_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      statusCode?: number;
      latencyMs?: number;
      checkedAt: string;
    };
    expect(body.status).toBe('ok');
    expect(body.statusCode).toBe(200);
    expect(typeof body.latencyMs).toBe('number');
    expect(typeof body.checkedAt).toBe('string');
    // HEAD-only path — no GET fallback fired.
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });

  it('HEAD 404 + GET 404 → degraded (GET fallback preserves HTTP code)', async () => {
    const row: ServerRow = {
      id: SERVER_ID,
      origin_url: 'https://example.com/mcp',
      organization_id: ORG_ID,
    };
    const stub = makeStubSupabase(row);
    requireAuthMock.mockResolvedValue(makeAuthResult(stub));
    safeFetchMock
      .mockResolvedValueOnce(mockHttpResponse(404))
      .mockResolvedValueOnce(mockHttpResponse(404));

    const res = await GET(makeRequest(SERVER_ID), {
      params: Promise.resolve({ id: SERVER_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; statusCode?: number };
    expect(body.status).toBe('degraded');
    expect(body.statusCode).toBe(404);
    expect(safeFetchMock).toHaveBeenCalledTimes(2);
  });

  it('both attempts throw SsrfBlockedError → down with reason=ssrf_blocked', async () => {
    const { SsrfBlockedError } = await import('@/lib/security/ssrf-guard');
    const row: ServerRow = {
      id: SERVER_ID,
      origin_url: 'https://169.254.169.254/latest/meta-data',
      organization_id: ORG_ID,
    };
    const stub = makeStubSupabase(row);
    requireAuthMock.mockResolvedValue(makeAuthResult(stub));
    safeFetchMock
      .mockRejectedValueOnce(new SsrfBlockedError('private_ip', 'bad'))
      .mockRejectedValueOnce(new SsrfBlockedError('private_ip', 'bad'));

    const res = await GET(makeRequest(SERVER_ID), {
      params: Promise.resolve({ id: SERVER_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; reason?: string };
    expect(body.status).toBe('down');
    expect(body.reason).toBe('ssrf_blocked');
  });

  it('both attempts throw AbortError → down with reason=timeout', async () => {
    const row: ServerRow = {
      id: SERVER_ID,
      origin_url: 'https://slow.example.com/mcp',
      organization_id: ORG_ID,
    };
    const stub = makeStubSupabase(row);
    requireAuthMock.mockResolvedValue(makeAuthResult(stub));
    const abort = (): Error => {
      const e = new Error('The operation was aborted due to timeout');
      e.name = 'AbortError';
      return e;
    };
    safeFetchMock.mockRejectedValueOnce(abort()).mockRejectedValueOnce(abort());

    const res = await GET(makeRequest(SERVER_ID), {
      params: Promise.resolve({ id: SERVER_ID }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; reason?: string };
    expect(body.status).toBe('down');
    expect(body.reason).toBe('timeout');
  });

  it('cross-org / unknown server id → 404 (never leaks existence)', async () => {
    const stub = makeStubSupabase(null);
    requireAuthMock.mockResolvedValue(makeAuthResult(stub));

    const res = await GET(makeRequest(OTHER_SERVER_ID), {
      params: Promise.resolve({ id: OTHER_SERVER_ID }),
    });
    expect(res.status).toBe(404);
    expect(safeFetchMock).not.toHaveBeenCalled();
  });
});
