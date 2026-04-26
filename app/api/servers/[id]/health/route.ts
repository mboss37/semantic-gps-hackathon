import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { probeServerOrigin } from '@/lib/servers/health';

// Sprint 14 WP-14.2 / Sprint 26 refactor: live origin health probe for
// /dashboard/servers/[id]. Probe logic moved to lib/servers/health.ts so
// the servers list page can run probes in parallel during render, see
// app/dashboard/servers/page.tsx. This route stays as the on-demand
// "refresh probe" endpoint when manually triggered.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export const GET = async (
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsed = ParamsSchema.safeParse(await ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from('servers')
    .select('id, origin_url, organization_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }
  const server = row as { id: string; origin_url: string | null; organization_id: string } | null;
  if (!server || server.organization_id !== organization_id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const result = await probeServerOrigin(server.origin_url);
  return NextResponse.json(result);
};
