import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export const DELETE = async (
  _request: Request,
  ctx: { params: Promise<{ id: string; assignmentId: string }> },
): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsed = ParamsSchema.safeParse(await ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid ids' }, { status: 400 });
  }

  const { error, count } = await supabase
    .from('policy_assignments')
    .delete({ count: 'exact' })
    .eq('id', parsed.data.assignmentId)
    .eq('policy_id', parsed.data.id);

  if (error) {
    return NextResponse.json({ error: 'delete failed', details: error.message }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  invalidateManifest();
  return NextResponse.json({ ok: true });
};
