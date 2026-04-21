import { createClient } from '@supabase/supabase-js';

// Service-role client. MCP gateway route ONLY — never in a user-scoped path.
// Bypasses RLS; caller is responsible for scoping.
export const createServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SECRET_KEY ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
