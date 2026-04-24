import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashToken } from '@/lib/mcp/auth-token';

// Sprint 7 WP-A.6: tests the gateway-token CRUD surface end-to-end by
// mocking `requireAuth` (so we don't need real cookies/SSR) and stubbing the
// Supabase client with a chainable in-memory store. Matches the hoisted-spy
// style from `gateway-auth.vitest.ts` so future WPs can swap impls.
//
// Covers:
//   1. unauthenticated GET/POST/DELETE → 401
//   2. POST mint → 201 + plaintext matches /^sgps_[0-9a-f]{64}$/ + row persisted with matching hash
//   3. GET → list excludes plaintext / hash
//   4. DELETE own row → 204 + row removed
//   5. DELETE cross-org id → 404

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

type TokenRow = {
  id: string;
  organization_id: string;
  token_hash: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

const ORG_A = '00000000-0000-0000-0000-0000000000a1';
const ORG_B = '00000000-0000-0000-0000-0000000000b2';

// Minimal in-memory table that supports the exact chain shapes the route
// handlers call. Each query returns a new thenable so `await` resolves once.
const makeStubSupabase = (rows: TokenRow[]) => {
  const snapshot = () => rows;

  const selectQuery = (_organizationId: string, cols: string) => {
    const projected = (r: TokenRow): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const col of cols.split(',').map((s) => s.trim())) {
        out[col] = (r as unknown as Record<string, unknown>)[col];
      }
      return out;
    };
    // Sprint 17 WP-17.2: the GET handler now chains .eq('organization_id',..)
    // .eq('kind','user'), so the mock must accept multiple .eq() calls before
    // .order() terminates. `kind` is never populated on test rows, so a filter
    // on 'user' value returns every row (rows default to undefined → undefined
    // !== 'user' would drop them, so treat undefined as 'user').
    const filters: Array<{ col: string; value: unknown }> = [];
    const chain = {
      eq: (col: string, value: unknown) => {
        filters.push({ col, value });
        return chain;
      },
      order: (_ordCol: string, _opts: { ascending: boolean }) =>
        Promise.resolve({
          data: snapshot()
            .filter((r) =>
              filters.every((f) => {
                const v = (r as unknown as Record<string, unknown>)[f.col];
                if (f.col === 'kind') return (v ?? 'user') === f.value;
                return v === f.value;
              }),
            )
            .map(projected),
          error: null,
        }),
    };
    return chain;
  };

  const insertQuery = (payload: Omit<TokenRow, 'id' | 'last_used_at' | 'created_at'>) => {
    const row: TokenRow = {
      id: `tok-${rows.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
      organization_id: payload.organization_id,
      token_hash: payload.token_hash,
      name: payload.name,
      last_used_at: null,
      created_at: new Date().toISOString(),
    };
    rows.push(row);
    return {
      select: (_cols: string) => ({
        single: () =>
          Promise.resolve({
            data: { id: row.id, name: row.name, created_at: row.created_at },
            error: null,
          }),
      }),
    };
  };

  const deleteQuery = () => {
    const eqFilters: Array<{ col: keyof TokenRow; value: string }> = [];
    const neqFilters: Array<{ col: string; value: string }> = [];
    const chain = {
      eq: (col: keyof TokenRow, value: string) => {
        eqFilters.push({ col, value });
        return chain;
      },
      neq: (col: string, value: string) => {
        neqFilters.push({ col, value });
        return chain;
      },
      select: (_cols: string) => {
        const matching = snapshot().filter(
          (r) =>
            eqFilters.every((f) => r[f.col] === f.value) &&
            neqFilters.every((f) => (r as unknown as Record<string, unknown>)[f.col] !== f.value),
        );
        for (const r of matching) {
          const idx = rows.indexOf(r);
          if (idx >= 0) rows.splice(idx, 1);
        }
        return Promise.resolve({
          data: matching.map((r) => ({ id: r.id })),
          error: null,
        });
      },
    };
    return chain;
  };

  return {
    from: (_table: string) => ({
      select: (cols: string) => ({
        eq: (_col: string, value: string) => selectQuery(value, cols).eq(_col, value),
      }),
      insert: (payload: Omit<TokenRow, 'id' | 'last_used_at' | 'created_at'>) =>
        insertQuery(payload),
      delete: () => deleteQuery(),
    }),
    _rows: rows,
  };
};

const { GET, POST } = await import('@/app/api/gateway-tokens/route');
const { DELETE } = await import('@/app/api/gateway-tokens/[id]/route');

const makeRequest = (init: RequestInit & { url?: string } = {}) =>
  new Request(init.url ?? 'http://localhost/api/gateway-tokens', init);

describe('gateway-tokens API (WP-A.6)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 on unauthenticated GET / POST / DELETE', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValue(new UnauthorizedError());

    const getRes = await GET();
    expect(getRes.status).toBe(401);

    const postRes = await POST(
      makeRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'blocked' }),
      }),
    );
    expect(postRes.status).toBe(401);

    const delRes = await DELETE(makeRequest({ method: 'DELETE' }), {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
    });
    expect(delRes.status).toBe(401);
  });

  it('POST mint returns 201 + sgps_<64hex> plaintext + row persisted with matching SHA-256 hash', async () => {
    const rows: TokenRow[] = [];
    const stub = makeStubSupabase(rows);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: ORG_A,
      role: 'admin',
    });

    const res = await POST(
      makeRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Claude Desktop' }),
      }),
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      plaintext: string;
      created_at: string;
    };
    expect(body.name).toBe('Claude Desktop');
    expect(body.plaintext).toMatch(/^sgps_[0-9a-f]{64}$/);

    // Row persisted, and the stored hash matches hashToken(plaintext).
    expect(rows).toHaveLength(1);
    expect(rows[0].organization_id).toBe(ORG_A);
    expect(rows[0].name).toBe('Claude Desktop');
    expect(rows[0].token_hash).toBe(hashToken(body.plaintext));
    // Plaintext must never be persisted, even accidentally.
    expect(JSON.stringify(rows[0])).not.toContain(body.plaintext);
  });

  it('POST rejects invalid body (empty name) with 400', async () => {
    const stub = makeStubSupabase([]);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: ORG_A,
      role: 'admin',
    });

    const res = await POST(
      makeRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('GET lists tokens without plaintext or token_hash', async () => {
    const rows: TokenRow[] = [
      {
        id: 't1',
        organization_id: ORG_A,
        token_hash: 'aaaa',
        name: 'alpha',
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 't2',
        organization_id: ORG_A,
        token_hash: 'bbbb',
        name: 'beta',
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 't3',
        organization_id: ORG_B,
        token_hash: 'cccc',
        name: 'other-org',
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
    ];
    const stub = makeStubSupabase(rows);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: ORG_A,
      role: 'admin',
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tokens: Array<Record<string, unknown>> };
    expect(body.tokens).toHaveLength(2);
    for (const t of body.tokens) {
      expect(Object.keys(t).sort()).toEqual(['created_at', 'id', 'last_used_at', 'name']);
      expect(t).not.toHaveProperty('token_hash');
      expect(t).not.toHaveProperty('plaintext');
    }
    // Cross-org row never surfaces.
    expect(body.tokens.some((t) => t.name === 'other-org')).toBe(false);
  });

  it('DELETE own row → 204 and row is gone', async () => {
    const rows: TokenRow[] = [
      {
        id: '00000000-0000-4000-8000-00000000aaaa',
        organization_id: ORG_A,
        token_hash: 'aaaa',
        name: 'to-be-revoked',
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
    ];
    const stub = makeStubSupabase(rows);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: ORG_A,
      role: 'admin',
    });

    const res = await DELETE(makeRequest({ method: 'DELETE' }), {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-00000000aaaa' }),
    });
    expect(res.status).toBe(204);
    expect(rows).toHaveLength(0);
  });

  it('DELETE cross-org id → 404 (information hiding, no 403)', async () => {
    const rows: TokenRow[] = [
      {
        id: '00000000-0000-4000-8000-00000000bbbb',
        organization_id: ORG_B,
        token_hash: 'bbbb',
        name: 'other-org-token',
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
    ];
    const stub = makeStubSupabase(rows);
    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: ORG_A,
      role: 'admin',
    });

    const res = await DELETE(makeRequest({ method: 'DELETE' }), {
      params: Promise.resolve({ id: '00000000-0000-4000-8000-00000000bbbb' }),
    });
    expect(res.status).toBe(404);
    // Row untouched — cross-org scope filter refused to match it.
    expect(rows).toHaveLength(1);
  });
});
