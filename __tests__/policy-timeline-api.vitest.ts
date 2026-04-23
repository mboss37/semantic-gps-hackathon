import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 12 WP-12.4 (I.4): per-policy shadow→enforce timeline route.
// Uses the hoisted-mock pattern from `gateway-tokens-api.vitest.ts` — we
// stub `requireAuth` so we don't need real cookies/SSR, and hand the route
// an in-memory Supabase stub that returns whatever rows the test case
// needs. Covers:
//   1. Unauthenticated → 401.
//   2. Cross-org / unknown policy id → 404.
//   3. `days=notanumber` → 400.
//   4. Happy path: three events with policy_decisions arrays mixing the
//      target policy and others get bucketed into the 7-day window with
//      correct counts and every day present (even the zero-count ones).

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

type PolicyRow = { id: string; name: string };
type EventRow = { created_at: string; policy_decisions: unknown };

const TARGET_POLICY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_POLICY_ID = '22222222-2222-4222-8222-222222222222';
const UNKNOWN_POLICY_ID = '33333333-3333-4333-8333-333333333333';

// A Supabase stub that returns `policyRow` for policies.eq('id', id) lookups
// and `eventRows` for the mcp_events.gte('created_at', since) query. The
// stub only supports the exact chain shapes the route handler uses — any
// deviation is a real bug and should blow up loudly.
const makeStubSupabase = (policyRow: PolicyRow | null, eventRows: EventRow[]) => {
  return {
    from: (table: string) => {
      if (table === 'policies') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: policyRow && policyRow.id === value ? policyRow : null,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'mcp_events') {
        return {
          select: (_cols: string) => ({
            gte: (_col: string, _since: string) =>
              Promise.resolve({ data: eventRows, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
};

const { GET } = await import('@/app/api/policies/[id]/timeline/route');

const makeRequest = (search = '') =>
  new Request(`http://localhost/api/policies/${TARGET_POLICY_ID}/timeline${search}`);

describe('policy timeline API (WP-12.4)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 on unauthenticated GET', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValue(new UnauthorizedError());

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: TARGET_POLICY_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the policy id does not belong to the caller (cross-org / unknown)', async () => {
    const stub = makeStubSupabase(null, []);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    const res = await GET(
      new Request(`http://localhost/api/policies/${UNKNOWN_POLICY_ID}/timeline`),
      { params: Promise.resolve({ id: UNKNOWN_POLICY_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when days is not a number', async () => {
    const stub = makeStubSupabase({ id: TARGET_POLICY_ID, name: 'pii' }, []);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    const res = await GET(makeRequest('?days=notanumber'), {
      params: Promise.resolve({ id: TARGET_POLICY_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('happy path: buckets decisions into the 7-day window, fills zero days, ignores other policies', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const todayIso = new Date(now).toISOString();
    const twoDaysAgoIso = new Date(now - 2 * day).toISOString();

    // Event A (today): one enforce block for target policy + one allow for
    // another policy (must be ignored).
    // Event B (today): one shadow block for target policy.
    // Event C (2 days ago): one allow for target policy + one redact for it
    // (redact is intentionally skipped — not part of shadow→enforce story).
    const eventRows: EventRow[] = [
      {
        created_at: todayIso,
        policy_decisions: [
          { policy_id: TARGET_POLICY_ID, mode: 'enforce', decision: 'block' },
          { policy_id: OTHER_POLICY_ID, mode: 'shadow', decision: 'block' },
        ],
      },
      {
        created_at: todayIso,
        policy_decisions: [
          { policy_id: TARGET_POLICY_ID, mode: 'shadow', decision: 'block' },
        ],
      },
      {
        created_at: twoDaysAgoIso,
        policy_decisions: [
          { policy_id: TARGET_POLICY_ID, mode: 'enforce', decision: 'allow' },
          { policy_id: TARGET_POLICY_ID, mode: 'enforce', decision: 'redact' },
        ],
      },
    ];

    const stub = makeStubSupabase({ id: TARGET_POLICY_ID, name: 'pii_redaction' }, eventRows);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: TARGET_POLICY_ID }),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      policy_id: string;
      policy_name: string;
      days: number;
      series: Array<{
        date: string;
        enforce_block: number;
        shadow_block: number;
        allow: number;
      }>;
    };

    expect(body.policy_id).toBe(TARGET_POLICY_ID);
    expect(body.policy_name).toBe('pii_redaction');
    expect(body.days).toBe(7);
    // 7 days fully filled, ascending by date.
    expect(body.series).toHaveLength(7);
    for (let i = 1; i < body.series.length; i += 1) {
      expect(body.series[i - 1].date.localeCompare(body.series[i].date)).toBeLessThan(0);
    }

    const todayKey = new Date(now).toISOString().slice(0, 10);
    const twoDaysAgoKey = new Date(now - 2 * day).toISOString().slice(0, 10);
    const today = body.series.find((b) => b.date === todayKey);
    const twoDaysAgo = body.series.find((b) => b.date === twoDaysAgoKey);

    // Today: 1 enforce_block + 1 shadow_block (other-policy block ignored).
    expect(today).toEqual({
      date: todayKey,
      enforce_block: 1,
      shadow_block: 1,
      allow: 0,
    });
    // 2 days ago: 1 allow (redact intentionally dropped).
    expect(twoDaysAgo).toEqual({
      date: twoDaysAgoKey,
      enforce_block: 0,
      shadow_block: 0,
      allow: 1,
    });

    // At least one zero-count bucket exists (the other 5 days).
    const zeroDays = body.series.filter(
      (b) => b.enforce_block === 0 && b.shadow_block === 0 && b.allow === 0,
    );
    expect(zeroDays.length).toBeGreaterThanOrEqual(5);
  });
});
