import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Sprint 16 WP-L.1 follow-up: Supabase email verification lands here with
// `?code=...` (PKCE). Exchange the code for a session, then let proxy.ts do
// the profile_completed → /onboarding vs /dashboard routing. Keeping the
// auth-gating logic in one place (proxy.ts) means no split-brain.

export const dynamic = 'force-dynamic';

export const GET = async (request: Request): Promise<Response> => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // proxy.ts handles the profile_completed → /onboarding vs /dashboard split.
  return NextResponse.redirect(`${origin}/dashboard`);
};
