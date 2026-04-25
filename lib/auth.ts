import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Decode custom claims from the Supabase JWT access token.
 * The custom_access_token_hook stamps organization_id + profile_completed
 * into the JWT on every token issuance. Reading them here avoids a DB
 * round-trip on every authenticated request.
 *
 * Returns null if the token is missing or malformed — callers fall back
 * to the membership DB query when this returns null.
 */
export const decodeJwtClaims = (accessToken: string): Record<string, unknown> | null => {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

// Sprint 20 WP-20.2: React cache() dedupes within a single RSC render request,
// collapsing the layout + page + helper getUser() round-trips (3+ network hops
// to Supabase Auth) down to one. Server Actions invoked from the same render
// share the cache automatically. Cache scope is per-request; isolated requests
// re-execute as expected.
export const requireAuth = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new UnauthorizedError();
  }

  // getSession() is convention-banned (spoofable), but getUser() above already
  // server-validated the user. We only need the raw JWT to decode custom claims
  // stamped by custom_access_token_hook — no auth decision relies on getSession().
  const { data: { session } } = await supabase.auth.getSession();
  const claims = session?.access_token
    ? decodeJwtClaims(session.access_token)
    : null;

  const claimOrgId = typeof claims?.organization_id === 'string'
    ? claims.organization_id
    : null;

  if (claimOrgId) {
    const claimProfileCompleted = claims?.profile_completed === true;
    return {
      user: data.user,
      supabase,
      organization_id: claimOrgId,
      role: 'admin' as const,
      profile_completed: claimProfileCompleted,
    };
  }

  // Fallback: JWT claims not yet stamped (pre-hook or first login).
  // Query the DB directly — mirrors the original Sprint 15 path.
  const { data: membership, error: memErr } = await supabase
    .from('memberships')
    .select('organization_id, role, profile_completed')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (memErr || !membership) {
    throw new UnauthorizedError('no membership');
  }
  return {
    user: data.user,
    supabase,
    organization_id: String(membership.organization_id),
    role: membership.role === 'member' ? 'member' : 'admin',
    profile_completed: membership.profile_completed === true,
  };
});
