import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

// Sprint 28 WP-28.2: per-route DELETE. Cross-org or unknown ids surface as
// 404 (never leak existence) per the same pattern as
// app/api/relationships/[id]/route.ts. route_steps cascade via FK so a
// single delete on `routes` removes the steps too. PATCH is intentionally
// NOT shipped in this sprint, delete + re-import is the v1 user pattern.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const awaited = await params;
  const parsed = ParamsSchema.safeParse(awaited);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  // Org-scoped existence check. 404 on miss to avoid leaking that an id
  // exists in another org.
  const { data: existing, error: lookupErr } = await supabase
    .from('routes')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('organization_id', organization_id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error: deleteErr } = await supabase
    .from('routes')
    .delete()
    .eq('id', parsed.data.id)
    .eq('organization_id', organization_id);

  if (deleteErr) {
    return NextResponse.json(
      { error: 'delete failed', details: deleteErr.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ ok: true });
};
