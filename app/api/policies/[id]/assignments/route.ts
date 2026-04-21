import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const CreateBody = z
  .object({
    server_id: z.string().uuid().optional(),
    tool_id: z.string().uuid().optional(),
  })
  .refine((v) => v.server_id !== undefined || v.tool_id !== undefined, {
    message: 'either server_id or tool_id is required',
  });

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export const POST = async (
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsedParams = ParamsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid policy id' }, { status: 400 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsedBody = CreateBody.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('policy_assignments')
    .insert({
      policy_id: parsedParams.data.id,
      server_id: parsedBody.data.server_id ?? null,
      tool_id: parsedBody.data.tool_id ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'assign failed', details: error?.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ assignment: data }, { status: 201 });
};
