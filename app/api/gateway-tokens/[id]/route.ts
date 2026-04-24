import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

// Sprint 7 WP-A.6: single-token revoke. Cross-org IDs return 404 (not 403)
// so existence can't be probed from another org. The eq().eq() pair does the
// scope enforcement — a missing row or a row in another org both map to the
// same "no rows affected" state.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

const notFound = (): Response =>
  NextResponse.json({ error: 'not_found' }, { status: 404 });

type RouteCtx = { params: Promise<{ id: string }> };

export const DELETE = async (_request: Request, ctx: RouteCtx): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsedParams = ParamsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return notFound();
  }

  const { data, error } = await supabase
    .from('gateway_tokens')
    .delete()
    .eq('id', parsedParams.data.id)
    .eq('organization_id', organization_id)
    .neq('kind', 'system')
    .select('id');

  if (error) {
    return NextResponse.json(
      { error: 'delete failed', details: error.message },
      { status: 500 },
    );
  }
  if (!data || data.length === 0) {
    return notFound();
  }

  return new Response(null, { status: 204 });
};
