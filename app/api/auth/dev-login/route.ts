import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DEV_EMAIL = 'demo@semantic-gps.dev';
const DEV_PASSWORD = 'demo-password-123';

// Local-only convenience route. Signs the seeded demo user in, then sends them
// to `?next=<path>` (default /dashboard). Production-safe because the seed row
// only exists in the local stack — hosted ignores `supabase/seed.sql`.

export const GET = async (request: NextRequest) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_LOGIN) {
    return NextResponse.json({ error: 'dev login disabled' }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawNext = request.nextUrl.searchParams.get('next') ?? '/dashboard';
  // Only allow internal absolute paths. Reject schemes, double-slash, backslash.
  const safeNext = /^\/[^/\\]/.test(rawNext) ? rawNext : '/dashboard';
  const url = request.nextUrl.clone();
  url.pathname = safeNext;
  url.search = '';
  return NextResponse.redirect(url);
};
