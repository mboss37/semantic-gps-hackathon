import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 30 WP-30.4: graph-adherence rate API.
// Hoisted-mock pattern matches `policy-timeline-api.vitest.ts`. Stub
// `requireAuth` so tests don't need real cookies, supply a Supabase stub
// that returns the `graph_adherence_pairs` view rows + `relationships`
// rows the case under test needs. Covers:
//   1. Unauthenticated → 401.
//   2. Empty buckets (zero pairs in either partition) → rate: null.
//   3. Happy path: mixed governed/raw pairs, some adhere, some don't,
//      rate math is correct + buckets are independent.
//   4. Invalid range query → 400.

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

// Bypass `fetchLatestEventMs`'s additional Supabase call. We don't want
// the helper to drive auto-range selection in tests, the stub above
// won't satisfy its `.maybeSingle()` shape.
vi.mock('@/lib/monitoring/range', async () => {
  const actual = await vi.importActual<typeof import('@/lib/monitoring/range')>('@/lib/monitoring/range');
  return {
    ...actual,
    fetchLatestEventMs: vi.fn(async () => null),
  };
});

type PairRow = {
  organization_id: string;
  from_tool_id: string;
  to_tool_id: string;
  governed: boolean;
  to_created_at: string;
};

type RelationshipRow = {
  from_tool_id: string;
  to_tool_id: string;
};

// Supabase chain stub. Mirrors the route's exact call shape so any drift
// (extra .eq, missed .gte, table typo) blows up loudly. `graph_adherence_pairs`
// chains `.select().eq().gte()`; `relationships` is a bare `.select()`.
const makeStubSupabase = (pairs: PairRow[], rels: RelationshipRow[]) => {
  return {
    from: (table: string) => {
      if (table === 'graph_adherence_pairs') {
        let filtered = [...pairs];
        let descBy: keyof PairRow | null = null;
        let limit: number | null = null;
        const finalize = () => {
          let out = [...filtered];
          if (descBy !== null) {
            const key = descBy;
            out.sort((a, b) => {
              const av = a[key] as string;
              const bv = b[key] as string;
              return av < bv ? 1 : av > bv ? -1 : 0;
            });
          }
          if (limit !== null) out = out.slice(0, limit);
          return Promise.resolve({ data: out, error: null });
        };
        const chain: {
          select: () => typeof chain;
          eq: (col: string, value: unknown) => typeof chain;
          gte: (col: string, value: unknown) => typeof chain;
          order: (
            col: string,
            opts?: { ascending?: boolean },
          ) => typeof chain;
          limit: (n: number) => Promise<{ data: PairRow[]; error: null }>;
          then: (
            onFulfilled: (v: { data: PairRow[]; error: null }) => unknown,
          ) => Promise<unknown>;
        } = {
          select: () => chain,
          eq: (col, value) => {
            filtered = filtered.filter(
              (r) => r[col as keyof PairRow] === value,
            );
            return chain;
          },
          gte: (col, value) => {
            filtered = filtered.filter(
              (r) => (r[col as keyof PairRow] as string) >= (value as string),
            );
            return chain;
          },
          order: (col, opts) => {
            if (opts?.ascending === false) descBy = col as keyof PairRow;
            return chain;
          },
          limit: (n) => {
            limit = n;
            return finalize();
          },
          // Awaiting the chain without `.limit()` (legacy callsites or future
          // tests) still resolves cleanly via the same finalize().
          then: (onFulfilled) => finalize().then(onFulfilled),
        };
        return chain;
      }
      if (table === 'relationships') {
        return {
          select: () => Promise.resolve({ data: rels, error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
};

const { GET } = await import('@/app/api/monitoring/graph-adherence/route');

const ORG = '00000000-0000-4000-8000-000000000001';
const TOOL_A = '00000000-0000-4000-8000-00000000000a';
const TOOL_B = '00000000-0000-4000-8000-00000000000b';
const TOOL_C = '00000000-0000-4000-8000-00000000000c';
const TOOL_D = '00000000-0000-4000-8000-00000000000d';

const makeRequest = (search = '') =>
  new Request(`http://localhost/api/monitoring/graph-adherence${search}`);

describe('graph-adherence API (WP-30.4)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 on unauthenticated GET', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValue(new UnauthorizedError());

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 400 when the range query param is invalid', async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: makeStubSupabase([], []),
      organization_id: ORG,
      role: 'admin',
    });

    const res = await GET(makeRequest('?range=banana'));
    expect(res.status).toBe(400);
  });

  it('returns rate: null in both buckets when there are zero pairs in the window', async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: makeStubSupabase([], []),
      organization_id: ORG,
      role: 'admin',
    });

    const res = await GET(makeRequest('?range=1h'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      governed: { adhering: number; total: number; rate: number | null };
      raw: { adhering: number; total: number; rate: number | null };
      range: { window: string; start: string; end: string };
    };

    expect(body.governed).toEqual({ adhering: 0, total: 0, rate: null });
    expect(body.raw).toEqual({ adhering: 0, total: 0, rate: null });
    expect(body.range.window).toBe('1h');
    expect(typeof body.range.start).toBe('string');
    expect(typeof body.range.end).toBe('string');
  });

  it('partitions adherence by governed and computes correct rates', async () => {
    // Edges: A→B, C→D (only these two exist in `relationships`).
    const rels: RelationshipRow[] = [
      { from_tool_id: TOOL_A, to_tool_id: TOOL_B },
      { from_tool_id: TOOL_C, to_tool_id: TOOL_D },
    ];

    // Window will accept any to_created_at >= now-1h; pin pairs to "now"
    // so they pass the gte filter.
    const recent = new Date().toISOString();

    // Governed pairs: 3 total, 2 adhere (A→B, C→D), 1 does not (A→C).
    // Raw pairs: 2 total, 1 adheres (C→D), 1 does not (B→A).
    const pairs: PairRow[] = [
      { organization_id: ORG, from_tool_id: TOOL_A, to_tool_id: TOOL_B, governed: true,  to_created_at: recent },
      { organization_id: ORG, from_tool_id: TOOL_C, to_tool_id: TOOL_D, governed: true,  to_created_at: recent },
      { organization_id: ORG, from_tool_id: TOOL_A, to_tool_id: TOOL_C, governed: true,  to_created_at: recent },
      { organization_id: ORG, from_tool_id: TOOL_C, to_tool_id: TOOL_D, governed: false, to_created_at: recent },
      { organization_id: ORG, from_tool_id: TOOL_B, to_tool_id: TOOL_A, governed: false, to_created_at: recent },
    ];

    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: makeStubSupabase(pairs, rels),
      organization_id: ORG,
      role: 'admin',
    });

    const res = await GET(makeRequest('?range=1h'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      governed: { adhering: number; total: number; rate: number | null };
      raw: { adhering: number; total: number; rate: number | null };
      range: { window: string; start: string; end: string };
    };

    expect(body.governed).toEqual({
      adhering: 2,
      total: 3,
      rate: 2 / 3,
    });
    expect(body.raw).toEqual({
      adhering: 1,
      total: 2,
      rate: 0.5,
    });
    expect(body.range.window).toBe('1h');
  });

  it('returns rate: null only on the bucket that is empty when one is populated and the other is not', async () => {
    const rels: RelationshipRow[] = [{ from_tool_id: TOOL_A, to_tool_id: TOOL_B }];
    const recent = new Date().toISOString();

    // Only governed pairs exist; raw bucket should be empty / null.
    const pairs: PairRow[] = [
      { organization_id: ORG, from_tool_id: TOOL_A, to_tool_id: TOOL_B, governed: true, to_created_at: recent },
    ];

    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: makeStubSupabase(pairs, rels),
      organization_id: ORG,
      role: 'admin',
    });

    const res = await GET(makeRequest('?range=1h'));
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      governed: { adhering: number; total: number; rate: number | null };
      raw: { adhering: number; total: number; rate: number | null };
    };

    expect(body.governed).toEqual({ adhering: 1, total: 1, rate: 1 });
    expect(body.raw).toEqual({ adhering: 0, total: 0, rate: null });
  });
});
