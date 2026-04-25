import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchMonitoringWindowed } from '@/lib/monitoring/fetch-windowed';
import {
  MONITORING_RANGES,
  fetchLatestEventMs,
  pickAutoRange,
  type MonitoringRange,
} from '@/lib/monitoring/range';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  range: z.enum(MONITORING_RANGES as unknown as [MonitoringRange, ...MonitoringRange[]]).optional(),
  serverId: z.string().uuid().optional(),
});

export const GET = async (req: Request) => {
  try {
    const { supabase, organization_id } = await requireAuth();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      range: url.searchParams.get('range') ?? undefined,
      serverId: url.searchParams.get('serverId') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
    }
    const range: MonitoringRange =
      parsed.data.range ?? pickAutoRange(await fetchLatestEventMs(supabase, organization_id));
    const data = await fetchMonitoringWindowed(
      supabase,
      organization_id,
      range,
      Date.now(),
      parsed.data.serverId,
    );
    return NextResponse.json({ range, ...data });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
};
