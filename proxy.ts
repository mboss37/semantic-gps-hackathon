import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwtClaims } from '@/lib/auth';

// Next.js 16 uses proxy.ts, NOT middleware.ts. Exports `proxy`, not `middleware`.
// Keeps the Supabase session cookie fresh and redirects unauthed dashboard hits.

export const proxy = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const requiresAuth = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding');

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Sprint 15 A.7: profile_completed gate. Authed users with an incomplete
  // profile route through /onboarding (except when already there, to avoid
  // the redirect loop). Authed users with profile_completed=true who hit
  // /onboarding get bounced back to /dashboard.
  //
  // Sprint 19: read profile_completed from JWT claims instead of a DB query.
  // The custom_access_token_hook stamps profile_completed into the JWT on
  // every token issuance (login + refresh). getSession() here is safe
  // because we already validated the user via getUser() above — we're only
  // reading a claim from the already-authenticated, Supabase-signed JWT,
  // not using getSession() as an authentication substitute.
  if (user) {
    const isDashboard = pathname.startsWith('/dashboard');
    const isOnboarding = pathname.startsWith('/onboarding');
    if (isDashboard || isOnboarding) {
      const { data: { session } } = await supabase.auth.getSession();
      const claims = session?.access_token
        ? decodeJwtClaims(session.access_token)
        : null;
      const completed = claims?.profile_completed === true;
      if (isDashboard && !completed) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        return NextResponse.redirect(url);
      }
      if (isOnboarding && completed) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
};

export const config = {
  matcher: [
    // Skip /api/mcp (anonymous gateway, no session) and static assets.
    '/((?!api/mcp|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
