import { NextResponse } from 'next/server';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

// Dev/ops-only cache invalidation. Direct DB mutations (Supabase MCP, docker
// psql seeds) bypass the per-scope in-memory cache. This endpoint lets a
// developer hit POST and force a rebuild on the next request.
//
// - Production is 404'd by default. Opt in per environment via
//   MANIFEST_INTROSPECTION_ENABLED=1 if you need ops access.
// - Auth: requires a Supabase session. We do NOT want anyone reaching this
//   endpoint without belonging to an org, even in dev.
// - Scope: the singleton per-scope Map is tiny (<10 entries in practice).
//   Clearing all is O(n) and cheaper than plumbing scoped invalidation
//   through the API surface. Future scoped clears can land if they prove
//   necessary.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async (): Promise<Response> => {
  const isProd = process.env.NODE_ENV === 'production';
  const opsEnabled = process.env.MANIFEST_INTROSPECTION_ENABLED === '1';
  if (isProd && !opsEnabled) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  invalidateManifest();
  return NextResponse.json({ ok: true });
};
