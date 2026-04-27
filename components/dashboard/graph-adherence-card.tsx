'use client';

import { TrendingDownIcon, TrendingUpIcon, MinusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DASHBOARD_REFRESH_EVENT } from '@/hooks/use-dashboard-refresh';
import type { MonitoringRange } from '@/lib/monitoring/range';

// Sprint 30 WP-30.4 follow-on: surface the graph-adherence metric on
// the dashboard. The API endpoint partitions trace_id-linked tools/call
// pairs by `governed` (gateway scopes) vs `raw` (the escape hatch a
// directly-connected MCP would expose). When governed climbs while raw
// stays flat the manifest-as-graph steering is changing model behavior.
//
// Both sides return `rate: null` when there are zero pairs in the
// window. We render that as `—`, distinct from `0.0%` (which would mean
// "agent ignored every declared edge").

type Bucket = { adhering: number; total: number; rate: number | null };

type GraphAdherenceResponse = {
  governed: Bucket;
  raw: Bucket;
  range: { window: MonitoringRange; start: string; end: string };
};

type Props = { range: MonitoringRange | null };

const tintedPill =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium';

const formatRate = (rate: number | null): string =>
  rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;

const formatCount = (n: number): string => n.toLocaleString('en-US');

type Lift = { label: string; tint: string; Icon: typeof TrendingUpIcon };

const renderLift = (governed: number | null, raw: number | null): Lift => {
  if (governed === null || raw === null) {
    return {
      label: 'awaiting data',
      tint: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
      Icon: MinusIcon,
    };
  }
  const ppDiff = (governed - raw) * 100;
  if (ppDiff === 0) {
    return {
      label: 'no lift vs raw',
      tint: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
      Icon: MinusIcon,
    };
  }
  const sign = ppDiff > 0 ? '+' : '';
  const tint =
    ppDiff > 0
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  const Icon = ppDiff > 0 ? TrendingUpIcon : TrendingDownIcon;
  return { label: `${sign}${ppDiff.toFixed(1)} pp vs raw`, tint, Icon };
};

export const GraphAdherenceCard = ({ range }: Props) => {
  const [data, setData] = useState<GraphAdherenceResponse | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const url = range
          ? `/api/monitoring/graph-adherence?range=${range}`
          : `/api/monitoring/graph-adherence`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const body = (await res.json()) as GraphAdherenceResponse;
        if (cancelled) return;
        setData(body);
      } catch {
        // Transient errors keep the last good render; the card never blanks.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range, refreshTick]);

  useEffect(() => {
    const onRefresh = () => setRefreshTick((n) => n + 1);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, []);

  const governedRate = data?.governed.rate ?? null;
  const rawRate = data?.raw.rate ?? null;
  const lift = renderLift(governedRate, rawRate);
  const governedTotal = data?.governed.total ?? 0;
  const rawTotal = data?.raw.total ?? 0;
  const totalPairs = governedTotal + rawTotal;

  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>Graph adherence</CardDescription>
        <CardTitle className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-2xl font-semibold tabular-nums @[400px]/card:text-3xl">
          <span>
            {formatRate(governedRate)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">governed</span>
          </span>
          <span className="text-xl font-medium text-zinc-300 @[400px]/card:text-2xl">
            {formatRate(rawRate)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">raw</span>
          </span>
        </CardTitle>
        <CardAction>
          <span className={`${tintedPill} ${lift.tint}`}>
            <lift.Icon className="size-3.5" />
            {lift.label}
          </span>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          Did declared edges steer the agent in this window?
        </div>
        <div className="text-muted-foreground">
          {totalPairs === 0
            ? 'No trace-linked tools/call pairs yet'
            : `${formatCount(governedTotal)} governed pairs · ${formatCount(rawTotal)} raw pairs`}
        </div>
      </CardFooter>
    </Card>
  );
};
