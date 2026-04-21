import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const UpdateBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    enforcement_mode: z.enum(['shadow', 'enforce']).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.config !== undefined || v.enforcement_mode !== undefined,
    { message: 'at least one field required' },
  );

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

type RouteCtx = { params: Promise<{ id: string }> };

export const PATCH = async (request: Request, ctx: RouteCtx): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsedParams = ParamsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsedBody = UpdateBody.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('policies')
    .update(parsedBody.data)
    .eq('id', parsedParams.data.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'update failed', details: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  invalidateManifest();
  return NextResponse.json({ policy: data });
};

export const DELETE = async (_request: Request, ctx: RouteCtx): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsedParams = ParamsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const { error } = await supabase.from('policies').delete().eq('id', parsedParams.data.id);
  if (error) {
    return NextResponse.json({ error: 'delete failed', details: error.message }, { status: 500 });
  }

  invalidateManifest();
  return NextResponse.json({ ok: true });
};
