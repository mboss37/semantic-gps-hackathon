import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Sprint 24 WP-24.2: headline KPI strip above the monitoring charts.
// Datadog/Honeycomb pattern — judges see the four numbers that matter
// before they parse the bar charts. Deltas compare to the equal-length
// window immediately prior so a 1h range shows "vs prior 1h", a 7d range
// shows "vs prior 7d".

export type MonitoringKpisProps = {
  current: {
    totalCalls: number;
    errorRate: number;
    blockRate: number;
    p95LatencyMs: number;
  };
  prior: {
    totalCalls: number;
    errorRate: number;
    blockRate: number;
    p95LatencyMs: number;
  };
};

const tintedPill =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium';

const formatPercent = (rate: number): string => `${(rate * 100).toFixed(1)}%`;
const formatLatency = (ms: number): string => (ms === 0 ? '—' : `${ms} ms`);
const formatCount = (n: number): string => n.toLocaleString('en-US');

// Higher-is-better metrics (calls): up=emerald, down=amber.
// Lower-is-better metrics (error / block / latency): inverted — up=amber, down=emerald.
type DeltaIntent = 'higher-is-better' | 'lower-is-better';

const renderDelta = (
  current: number,
  prior: number,
  intent: DeltaIntent,
  formatter: (n: number) => string,
): { label: string; tint: string; Icon: typeof TrendingUpIcon } => {
  if (prior === 0 && current === 0) {
    return {
      label: 'no prior data',
      tint: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
      Icon: TrendingUpIcon,
    };
  }
  if (prior === 0) {
    return {
      label: `+${formatter(current)} new`,
      tint: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
      Icon: TrendingUpIcon,
    };
  }
  const diff = current - prior;
  const pct = Math.round((diff / prior) * 100);
  const up = diff >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  const isGood = intent === 'higher-is-better' ? up : !up;
  const tint = isGood
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  const sign = pct > 0 ? '+' : '';
  return { label: `${sign}${pct}%`, tint, Icon };
};

export const MonitoringKpiStrip = ({ current, prior }: MonitoringKpisProps) => {
  const callsDelta = renderDelta(current.totalCalls, prior.totalCalls, 'higher-is-better', formatCount);
  const errorDelta = renderDelta(current.errorRate, prior.errorRate, 'lower-is-better', formatPercent);
  const blockDelta = renderDelta(current.blockRate, prior.blockRate, 'lower-is-better', formatPercent);
  const latencyDelta = renderDelta(
    current.p95LatencyMs,
    prior.p95LatencyMs,
    'lower-is-better',
    formatLatency,
  );

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <KpiCard
        label="Total calls"
        value={formatCount(current.totalCalls)}
        deltaLabel={callsDelta.label}
        deltaTint={callsDelta.tint}
        DeltaIcon={callsDelta.Icon}
        footerLine="Gateway events in window"
        footerSub="vs equal prior window"
      />
      <KpiCard
        label="Error rate"
        value={formatPercent(current.errorRate)}
        deltaLabel={errorDelta.label}
        deltaTint={errorDelta.tint}
        DeltaIcon={errorDelta.Icon}
        footerLine="Origin + auth + invalid input"
        footerSub="non-ok responses / total"
      />
      <KpiCard
        label="Block rate"
        value={formatPercent(current.blockRate)}
        deltaLabel={blockDelta.label}
        deltaTint={blockDelta.tint}
        DeltaIcon={blockDelta.Icon}
        footerLine="Policy blocks (enforce mode)"
        footerSub="blocked / total"
      />
      <KpiCard
        label="p95 latency"
        value={formatLatency(current.p95LatencyMs)}
        deltaLabel={latencyDelta.label}
        deltaTint={latencyDelta.tint}
        DeltaIcon={latencyDelta.Icon}
        footerLine="95th percentile request"
        footerSub="includes upstream + policy stack"
      />
    </div>
  );
};

type KpiCardProps = {
  label: string;
  value: string;
  deltaLabel: string;
  deltaTint: string;
  DeltaIcon: typeof TrendingUpIcon;
  footerLine: string;
  footerSub: string;
};

const KpiCard = ({
  label,
  value,
  deltaLabel,
  deltaTint,
  DeltaIcon,
  footerLine,
  footerSub,
}: KpiCardProps) => (
  <Card className="@container/card">
    <CardHeader>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
        {value}
      </CardTitle>
      <CardAction>
        <span className={`${tintedPill} ${deltaTint}`}>
          <DeltaIcon className="size-3.5" />
          {deltaLabel}
        </span>
      </CardAction>
    </CardHeader>
    <CardFooter className="flex-col items-start gap-1.5 text-sm">
      <div className="line-clamp-1 flex gap-2 font-medium">{footerLine}</div>
      <div className="text-muted-foreground">{footerSub}</div>
    </CardFooter>
  </Card>
);
