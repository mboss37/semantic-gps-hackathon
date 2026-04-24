import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  trace_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
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
    trace_id: url.searchParams.get('trace_id') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let query = supabase
    .from('mcp_events')
    .select(
      'id, trace_id, server_id, tool_name, method, status, policy_decisions, latency_ms, created_at',
      { count: 'exact' },
    )
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })
    .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

  if (parsed.data.trace_id) {
    query = query.eq('trace_id', parsed.data.trace_id);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  return NextResponse.json({
    events: data ?? [],
    total: count ?? 0,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
};
