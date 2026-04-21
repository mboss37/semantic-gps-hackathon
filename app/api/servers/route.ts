import { NextResponse } from 'next/server';
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
