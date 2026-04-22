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
  const { data: membership, error: memErr } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (memErr || !membership) {
    throw new UnauthorizedError('no membership');
  }
  return {
    user: data.user,
    supabase,
    organization_id: membership.organization_id as string,
    role: membership.role as 'admin',
  };
};
