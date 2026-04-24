import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 14 WP-14.1: gateway traffic API backing the dashboard overview chart.
// Same hoisted-mock + in-memory Supabase shape as `policy-timeline-api.vitest.ts`.

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    requireAuth: requireAuthMock,
  };
});

type EventRow = { created_at: string; status: string };

const makeStubSupabase = (rows: EventRow[]) => ({
  from: (table: string) => {
    if (table !== 'mcp_events') throw new Error(`unexpected table: ${table}`);
    return {
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          gte: (_gteCol: string, _since: string) =>
            Promise.resolve({ data: rows, error: null }),
        }),
      }),
    };
  },
});

const { GET } = await import('@/app/api/gateway-traffic/route');

const makeRequest = (search = '') =>
  new Request(`http://localhost/api/gateway-traffic${search}`);

describe('gateway-traffic API (Sprint 14.1)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValue(new UnauthorizedError());
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid range value', async () => {
    const stub = makeStubSupabase([]);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });
    const res = await GET(makeRequest('?range=bogus'));
    expect(res.status).toBe(400);
  });

  it('happy path: 7d returns 7 buckets with ok/blocked/error split', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const todayIso = new Date(now).toISOString();
    const twoDaysAgoIso = new Date(now - 2 * day).toISOString();

    const rows: EventRow[] = [
      { created_at: todayIso, status: 'ok' },
      { created_at: todayIso, status: 'ok' },
      { created_at: todayIso, status: 'blocked_by_policy' },
      { created_at: twoDaysAgoIso, status: 'origin_error' },
    ];

    const stub = makeStubSupabase(rows);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    const res = await GET(makeRequest('?range=7d'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      range: string;
      series: Array<{ date: string; ok: number; blocked: number; error: number }>;
    };
    expect(body.range).toBe('7d');
    expect(body.series).toHaveLength(7);

    // Series must be sorted ascending and cover 7 contiguous UTC days.
    for (let i = 1; i < body.series.length; i += 1) {
      expect(body.series[i - 1].date.localeCompare(body.series[i].date)).toBeLessThan(0);
    }

    const todayKey = new Date(now).toISOString().slice(0, 10);
    const twoDaysAgoKey = new Date(now - 2 * day).toISOString().slice(0, 10);
    const today = body.series.find((b) => b.date === todayKey);
    const twoDaysAgo = body.series.find((b) => b.date === twoDaysAgoKey);

    expect(today).toEqual({ date: todayKey, ok: 2, blocked: 1, error: 0 });
    expect(twoDaysAgo).toEqual({ date: twoDaysAgoKey, ok: 0, blocked: 0, error: 1 });
  });
});
