import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Focused feed for the graph cascade visualization (Sprint 8 WP-I.2).
// Sprint 15: `mcp_events.organization_id` now exists, so we filter directly
// instead of joining through servers. This also includes auth-level events
// (pre-scope failures) for the caller's org — the old server-join approach
// silently dropped them.

const QuerySchema = z.object({
  status: z.enum(['rollback_executed']).default('rollback_executed'),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = async (request: Request): Promise<Response> => {
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

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let query = supabase
    .from('mcp_events')
    .select('id, trace_id, server_id, tool_name, created_at, payload_redacted')
    .eq('organization_id', organization_id)
    .eq('status', parsed.data.status)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.since) {
    query = query.gt('created_at', parsed.data.since);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    id: row.id as string,
    trace_id: row.trace_id as string,
    server_id: (row.server_id as string | null) ?? null,
    tool_name: (row.tool_name as string | null) ?? null,
    created_at: row.created_at as string,
    payload: row.payload_redacted ?? null,
  }));

  return NextResponse.json({ events });
};
