import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Focused feed for the graph cascade visualization (Sprint 8 WP-I.2).
// Scoped to the caller's org via a server join — `mcp_events` has no
// `organization_id` column, so we filter through `servers.organization_id`.
// Events without a `server_id` (rare: pre-resolution failures) are excluded
// for safety. No fallback to cross-org data.

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

  // Resolve org's server ids first — cheaper than a server-side join that
  // forces the REST layer into inner-join mode with jsonb filters.
  const { data: orgServers, error: serversErr } = await supabase
    .from('servers')
    .select('id')
    .eq('organization_id', organization_id);
  if (serversErr) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
  const serverIds = (orgServers ?? []).map((s) => s.id as string);
  if (serverIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  let query = supabase
    .from('mcp_events')
    .select('id, trace_id, server_id, tool_name, created_at, payload_redacted')
    .eq('status', parsed.data.status)
    .in('server_id', serverIds)
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
