import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, UnauthorizedError } from '@/lib/auth';

// Sprint 22 WP-22.2: per-event detail for the audit Sheet drawer.
// Same org-scoping contract as the list route — `requireAuth` returns the
// scoped supabase client + organization_id, then `.eq('organization_id', ...)`
// belt-and-braces in case RLS gets disabled in the future. `payload_redacted`
// is included here (deliberately omitted from the list query for payload
// size) since the user is already authenticated for their own org.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export const GET = async (
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

  const { data, error } = await supabase
    .from('mcp_events')
    .select(
      'id, trace_id, server_id, tool_name, method, status, policy_decisions, latency_ms, payload_redacted, created_at, servers(name)',
    )
    .eq('id', parsed.data.id)
    .eq('organization_id', organization_id)
    .maybeSingle();

  if (error) {
    console.error('[audit-detail] fetch failed', error.message);
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  // Flatten the embedded `servers(name)` (PostgREST returns a single object
  // at runtime for the to-one FK; Supabase JS's generated types lie and call
  // it an array — cast through unknown). Same shape as the list route.
  const row = data as unknown as typeof data & { servers: { name: string } | null };
  const { servers, ...rest } = row;
  const event = { ...rest, server_name: servers?.name ?? null };
  return NextResponse.json({ event });
};
