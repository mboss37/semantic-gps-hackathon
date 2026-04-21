import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

export const DELETE = async (
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const rawParams = await ctx.params;
  const parsed = ParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const { error } = await supabase.from('servers').delete().eq('id', parsed.data.id);
  if (error) {
    return NextResponse.json({ error: 'delete failed', details: error.message }, { status: 500 });
  }

  invalidateManifest();
  return NextResponse.json({ ok: true });
};
