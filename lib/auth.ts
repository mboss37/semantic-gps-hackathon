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
  return { user: data.user, supabase };
};
