import { createClient } from '@/lib/supabase/server';

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export const requireAuth = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new UnauthorizedError();
  }
  // Sprint 15 A.7: profile_completed gates onboarding. Callers decide how to
  // react — dashboard pages redirect to /onboarding via proxy.ts + layout.tsx;
  // the /onboarding page itself checks this flag to bounce already-onboarded
  // users back to /dashboard.
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
