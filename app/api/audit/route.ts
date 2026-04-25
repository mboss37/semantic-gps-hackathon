import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { bucketAuditTimeline } from '@/lib/audit/timeline';
import {
  MONITORING_RANGES,
  RANGE_SPECS,
  anchorMs,
  fetchLatestEventMs,
  pickAutoRange,
  type MonitoringRange,
} from '@/lib/monitoring/range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  trace_id: z.string().uuid().optional(),
  range: z
    .enum(MONITORING_RANGES as unknown as [MonitoringRange, ...MonitoringRange[]])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

const sinceFor = (range: MonitoringRange): string => {
  const spec = RANGE_SPECS[range];
  const anchor = anchorMs(Date.now(), spec);
  const earliest = anchor - (spec.bucketCount - 1) * spec.bucketMs;
  return new Date(earliest).toISOString();
};

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
    range: url.searchParams.get('range') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Auto-pick the smallest range that includes the latest event when the
  // client doesn't specify one. Lands users on a useful default instead of
  // an empty 1h chart when their last call was 4 hours ago.
  const range: MonitoringRange =
    parsed.data.range ?? pickAutoRange(await fetchLatestEventMs(supabase, organization_id));

  let query = supabase
    .from('mcp_events')
    .select(
      'id, trace_id, server_id, tool_name, method, status, policy_decisions, latency_ms, created_at',
      { count: 'exact' },
    )
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })
    .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1)
    .gte('created_at', sinceFor(range));

  if (parsed.data.trace_id) {
    query = query.eq('trace_id', parsed.data.trace_id);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const events = data ?? [];
  const timeline = bucketAuditTimeline(events, range);

  return NextResponse.json({
    events,
    total: count ?? 0,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    range,
    timeline,
  });
};
