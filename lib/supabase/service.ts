import { createClient } from '@supabase/supabase-js';

// Service-role client. MCP gateway route ONLY — never in a user-scoped path.
// Bypasses RLS; caller is responsible for scoping.
//
// Throw loudly on missing env instead of silently coalescing to ''. An empty
// key builds a client that returns null for every query, which surfaces as a
// silent 401 at the gateway (see Sprint 6 postmortem: Vercel "Sensitive" env
// dropout broke prod with zero log signal). Throwing here puts a stack trace
// in `vercel logs` the next time this breaks.
export const createServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SECRET_KEY']
      .filter(Boolean)
      .join(' + ');
    throw new Error(`createServiceClient: missing env ${missing}`);
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
