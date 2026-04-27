import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import {
  MONITORING_RANGES,
  RANGE_SPECS,
  anchorMs,
  fetchLatestEventMs,
  pickAutoRange,
  type MonitoringRange,
} from '@/lib/monitoring/range';

// Sprint 30 WP-30.4: graph-adherence rate metric.
//
// "Did description enrichment actually move agent behavior?" The metric:
// for every consecutive pair of `tools/call` events sharing a `trace_id`,
// did the second tool call follow a known TRel edge from the first? Rate
// = adhering / total, computed once for governed surfaces (`/api/mcp` +
// scoped variants) and once for the raw escape hatch. The contrast is the
// proof: if governed climbs while raw stays flat, the manifest steering
// is changing model behavior, not vibes.
//
// Both partitions return `rate: null` when there are zero pairs in the
// window; that's "no data" and is meaningfully distinct from "zero
// adherence" (which would render as `rate: 0`).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  range: z.enum(MONITORING_RANGES as unknown as [MonitoringRange, ...MonitoringRange[]]).optional(),
});

type AdherenceBucket = {
  adhering: number;
  total: number;
  rate: number | null;
};

type PairRow = {
  from_tool_id: string;
  to_tool_id: string;
  governed: boolean;
};

type RelationshipRow = {
  from_tool_id: string;
  to_tool_id: string;
};

const computeBucket = (pairs: PairRow[], edges: Set<string>, governed: boolean): AdherenceBucket => {
  let adhering = 0;
  let total = 0;
  for (const pair of pairs) {
    if (pair.governed !== governed) continue;
    total += 1;
    if (edges.has(`${pair.from_tool_id}:${pair.to_tool_id}`)) {
      adhering += 1;
    }
  }
  return {
    adhering,
    total,
    rate: total === 0 ? null : adhering / total,
  };
};

export const GET = async (req: Request): Promise<Response> => {
  try {
    const { supabase, organization_id } = await requireAuth();

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      range: url.searchParams.get('range') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_query', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const range: MonitoringRange =
      parsed.data.range ?? pickAutoRange(await fetchLatestEventMs(supabase, organization_id));
    const spec = RANGE_SPECS[range];
    const nowMs = Date.now();
    const anchor = anchorMs(nowMs, spec);
    const earliest = anchor - (spec.bucketCount - 1) * spec.bucketMs;
    const startIso = new Date(earliest).toISOString();
    const endIso = new Date(anchor + spec.bucketMs).toISOString();

    // Pull pairs from the view; RLS filters to caller's org. We still
    // pass `.eq('organization_id', ...)` belt-and-braces (CLAUDE.md rule).
    const { data: pairsData, error: pairsErr } = await supabase
      .from('graph_adherence_pairs')
      .select('from_tool_id, to_tool_id, governed')
      .eq('organization_id', organization_id)
      .gte('to_created_at', startIso);
    if (pairsErr) {
      console.error(
        '[graph-adherence] pairs query failed',
        pairsErr instanceof Error ? pairsErr.message : 'unknown error',
      );
      return NextResponse.json({ error: 'load_failed' }, { status: 500 });
    }
    const pairs = (pairsData ?? []) as PairRow[];

    // Pull all org-scoped edges in one shot. `relationships` has no direct
    // organization_id column, RLS join via tools→servers handles isolation.
    const { data: relsData, error: relsErr } = await supabase
      .from('relationships')
      .select('from_tool_id, to_tool_id');
    if (relsErr) {
      console.error(
        '[graph-adherence] relationships query failed',
        relsErr instanceof Error ? relsErr.message : 'unknown error',
      );
      return NextResponse.json({ error: 'load_failed' }, { status: 500 });
    }
    const edges = new Set(
      ((relsData ?? []) as RelationshipRow[]).map((r) => `${r.from_tool_id}:${r.to_tool_id}`),
    );

    return NextResponse.json({
      governed: computeBucket(pairs, edges, true),
      raw: computeBucket(pairs, edges, false),
      range: {
        window: range,
        start: startIso,
        end: endIso,
      },
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[graph-adherence] internal error', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
};
