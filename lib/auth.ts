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
const decodeJwtClaims = (accessToken: string): Record<string, unknown> | null => {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const requireAuth = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new UnauthorizedError();
  }

  // Sprint 19: read org + profile_completed from JWT claims first.
  // Falls back to the membership DB query when claims are unavailable
  // (e.g. first login before token refresh picks up the hook).
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
    organization_id: membership.organization_id as string,
    role: membership.role as 'admin' | 'member',
    profile_completed: membership.profile_completed as boolean,
  };
};
