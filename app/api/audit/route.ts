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
  // Sprint 29: trace_id can be the per-request UUID (one Claude Desktop tool
  // call) OR the caller-supplied UUID a Playground Run threads through every
  // internal MCP call, same field, two filling strategies. One filter
  // surfaces both naturally.
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
      'id, trace_id, server_id, tool_name, method, status, policy_decisions, latency_ms, created_at, servers(name)',
      { count: 'exact' },
    )
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false })
    .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

  // trace_id filter overrides the time-range narrowing, a Playground deep
  // link should surface every event from the run even if it falls outside
  // the default window. Otherwise apply the standard range gate.
  if (parsed.data.trace_id) {
    query = query.eq('trace_id', parsed.data.trace_id);
  } else {
    query = query.gte('created_at', sinceFor(range));
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  // PostgREST returns the embedded `servers(name)` as a single object at
  // runtime (the FK is to-one), even though Supabase JS's generated TS types
  // declare it as an array. Cast through `unknown` to match the runtime
  // shape and flatten to `server_name` so callers consume one flat record.
  type Row = {
    id: string;
    trace_id: string;
    server_id: string | null;
    tool_name: string | null;
    method: string;
    status: string;
    policy_decisions: unknown[];
    latency_ms: number | null;
    created_at: string;
    servers: { name: string } | null;
  };
  const events = ((data as unknown as Row[] | null) ?? []).map(({ servers, ...rest }) => ({
    ...rest,
    server_name: servers?.name ?? null,
  }));
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
