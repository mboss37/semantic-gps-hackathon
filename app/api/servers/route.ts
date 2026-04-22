import { NextResponse } from 'next/server';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto/encrypt';
import { invalidateManifest } from '@/lib/manifest/cache';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const [serversRes, toolsRes] = await Promise.all([
    supabase
      .from('servers')
      .select('id, name, origin_url, transport, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('tools').select('server_id'),
  ]);

  if (serversRes.error || toolsRes.error) {
    return NextResponse.json(
      { error: 'load failed', details: serversRes.error?.message ?? toolsRes.error?.message },
      { status: 500 },
    );
  }

  const counts = new Map<string, number>();
  for (const t of toolsRes.data ?? []) {
    const key = t.server_id as string | null;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    servers: (serversRes.data ?? []).map((s) => ({
      ...s,
      tool_count: counts.get(s.id) ?? 0,
    })),
  });
};

const PostBodySchema = z.object({
  name: z.string().min(1).max(200),
  origin_url: z.string().url(),
  auth: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('none') }),
      z.object({ type: z.literal('bearer'), token: z.string().min(1) }),
    ])
    .optional(),
});

export const POST = async (request: Request): Promise<Response> => {
  let user;
  let supabase;
  try {
    ({ user, supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, origin_url, auth } = parsed.data;
  const authConfig =
    auth?.type === 'bearer'
      ? { ciphertext: encrypt(JSON.stringify({ type: 'bearer', token: auth.token })) }
      : null;

  const { data: server, error } = await supabase
    .from('servers')
    .insert({ user_id: user.id, name, origin_url, transport: 'http-streamable', auth_config: authConfig })
    .select('id, name')
    .single();

  if (error ?? !server) {
    return NextResponse.json(
      { error: 'create failed', details: error?.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ server_id: server.id, name: server.name }, { status: 201 });
};
