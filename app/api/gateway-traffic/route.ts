import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchCallVolume } from '@/lib/monitoring/fetch';

// Sprint 14 WP-14.1: backs the Overview chart on /dashboard. Swaps the 2024
// fixture in `components/chart-area-interactive.tsx` for a live aggregation
// over `mcp_events`. Reuses `fetchCallVolume` (shipped Sprint 13.3) which
// already buckets by day splitting ok / blocked_by_policy / other.
//
// Range accepts the three discrete values the dashboard's ToggleGroup emits.
// Anything else → 400 (consistent with policy-timeline's `days` handling).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RangeSchema = z.enum(['7d', '30d', '90d']);

const QuerySchema = z.object({
  range: RangeSchema.default('90d'),
});

const rangeToDays = (range: z.infer<typeof RangeSchema>): number => {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  return 90;
};

export const GET = async (request: Request): Promise<Response> => {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    range: url.searchParams.get('range') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const series = await fetchCallVolume(supabase, rangeToDays(parsed.data.range));
    return NextResponse.json({ range: parsed.data.range, series });
  } catch (e) {
    console.error('[gateway-traffic] fetch failed', e);
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }
};
