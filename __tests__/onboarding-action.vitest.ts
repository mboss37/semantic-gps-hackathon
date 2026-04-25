import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 15 A.7: onboarding server action tests. Hoisted-mock pattern mirrors
// `gateway-traffic-api.vitest.ts`. Three writes under test: organizations.name
// + created_by (UPDATE), memberships.profile_completed (UPDATE),
// auth.users.raw_user_meta_data (auth.updateUser).

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

type StubOptions = {
  orgError?: { message: string };
  membershipError?: { message: string };
  userError?: { message: string };
  refreshError?: { message: string };
};

const makeStubSupabase = (opts: StubOptions = {}) => {
  const orgUpdates: Array<{ id?: string; payload: Record<string, unknown> }> = [];
  const membershipUpdates: Array<{
    filter: Record<string, string>;
    payload: Record<string, unknown>;
  }> = [];
  const userUpdates: Array<Record<string, unknown>> = [];
  const refreshCalls: number[] = [];

  const supabase = {
    from: (table: string) => {
      if (table === 'organizations') {
        return {
          update: (payload: Record<string, unknown>) => {
            const result = Promise.resolve({ error: opts.orgError ?? null });
            return {
              eq: (_col: string, value: string) => {
                orgUpdates.push({ id: value, payload });
                return {
                  is: () => result,
                  then: result.then.bind(result),
                  catch: result.catch.bind(result),
                };
              },
            };
          },
        };
      }
      if (table === 'memberships') {
        return {
          update: (payload: Record<string, unknown>) => {
            const filter: Record<string, string> = {};
            const chain = {
              eq: (col: string, value: string) => {
                filter[col] = value;
                // Two chained `.eq()` calls — second one resolves the promise.
                return Object.keys(filter).length < 2
                  ? chain
                  : (membershipUpdates.push({ filter, payload }),
                    Promise.resolve({ error: opts.membershipError ?? null }));
              },
            };
            return chain;
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
    auth: {
      updateUser: (payload: Record<string, unknown>) => {
        userUpdates.push(payload);
        return Promise.resolve({ error: opts.userError ?? null });
      },
      refreshSession: () => {
        refreshCalls.push(1);
        return Promise.resolve({ error: opts.refreshError ?? null });
      },
    },
  };

  return { supabase, orgUpdates, membershipUpdates, userUpdates, refreshCalls };
};

const { completeOnboarding } = await import('@/app/onboarding/actions');

const VALID_INPUT = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  company: 'Analytical Engines Ltd',
  org_name: 'Engines Platform',
};

describe('completeOnboarding action (Sprint 15 A.7)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates org, membership, and user metadata on happy path', async () => {
    const { supabase, orgUpdates, membershipUpdates, userUpdates } = makeStubSupabase();
    requireAuthMock.mockResolvedValue({
      user: { id: 'user-1', email: 'ada@example.com' },
      supabase,
      organization_id: 'org-1',
      role: 'admin',
      profile_completed: false,
    });

    const result = await completeOnboarding(VALID_INPUT);

    expect(result).toEqual({ ok: true });
    expect(orgUpdates).toEqual([
      { id: 'org-1', payload: { name: 'Engines Platform' } },
      { id: 'org-1', payload: { created_by: 'user-1' } },
    ]);
    expect(membershipUpdates).toHaveLength(1);
    expect(membershipUpdates[0].payload).toEqual({ profile_completed: true });
    expect(membershipUpdates[0].filter).toEqual({
      user_id: 'user-1',
      organization_id: 'org-1',
    });
    expect(userUpdates).toEqual([
      { data: { first_name: 'Ada', last_name: 'Lovelace', company: 'Analytical Engines Ltd' } },
    ]);
  });

  it('returns invalid_input with field issues when fields are empty', async () => {
    const result = await completeOnboarding({
      first_name: '',
      last_name: 'Lovelace',
      company: '  ',
      org_name: 'Engines',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false && result.error === 'invalid_input') {
      expect(result.issues.first_name).toBeDefined();
      expect(result.issues.company).toBeDefined();
    } else {
      throw new Error(`unexpected result: ${JSON.stringify(result)}`);
    }
    // requireAuth should NOT be called — Zod validation short-circuits.
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it('returns already_completed when profile_completed is true', async () => {
    const { supabase, orgUpdates, membershipUpdates, userUpdates } = makeStubSupabase();
    requireAuthMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase,
      organization_id: 'org-1',
      role: 'admin',
      profile_completed: true,
    });

    const result = await completeOnboarding(VALID_INPUT);

    expect(result).toEqual({ ok: false, error: 'already_completed' });
    // Early return must not touch ANY of the three write surfaces — the flag
    // flip is idempotent but org.name/created_by overwrites would be real
    // data loss on a stale replay.
    expect(orgUpdates).toHaveLength(0);
    expect(membershipUpdates).toHaveLength(0);
    expect(userUpdates).toHaveLength(0);
  });

  it('returns unauthorized when no session', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValue(new UnauthorizedError());

    const result = await completeOnboarding(VALID_INPUT);

    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('surfaces update_failed with detail when an underlying write errors', async () => {
    const { supabase } = makeStubSupabase({ orgError: { message: 'pg down' } });
    requireAuthMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase,
      organization_id: 'org-1',
      role: 'admin',
      profile_completed: false,
    });

    const result = await completeOnboarding(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok === false && result.error === 'update_failed') {
      expect(result.detail).toBe('org_update_failed');
    } else {
      throw new Error(`unexpected result: ${JSON.stringify(result)}`);
    }
  });

  it('returns session_refresh_failed when refreshSession errors', async () => {
    // Sprint 20 WP-20.1: locks the new refresh path. Without the cookie
    // refresh, proxy.ts keeps reading the stale signup-era JWT and bouncing
    // /dashboard back to /onboarding.
    const { supabase, refreshCalls } = makeStubSupabase({
      refreshError: { message: 'refresh denied' },
    });
    requireAuthMock.mockResolvedValue({
      user: { id: 'user-1' },
      supabase,
      organization_id: 'org-1',
      role: 'admin',
      profile_completed: false,
    });

    const result = await completeOnboarding(VALID_INPUT);

    expect(refreshCalls).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (result.ok === false && result.error === 'update_failed') {
      expect(result.detail).toBe('session_refresh_failed');
    } else {
      throw new Error(`unexpected result: ${JSON.stringify(result)}`);
    }
  });
});
