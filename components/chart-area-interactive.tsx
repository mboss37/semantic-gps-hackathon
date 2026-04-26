'use client';

import * as React from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { DASHBOARD_REFRESH_EVENT } from '@/hooks/use-dashboard-refresh';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/charts/palette';
import {
  MONITORING_RANGES,
  RANGE_LABEL,
  isMonitoringRange,
  type MonitoringRange,
} from '@/lib/monitoring/range';

export const description = 'Gateway traffic line chart';

// Sprint 14 WP-14.1 / Sprint 26 unified: same LineChart shape as the audit
// timeline (monotone curves so the line never overshoots into the negative
// half-plane on natural-spline interpolation, integer YAxis ticks, shared
// palette + range vocabulary). Backed by /api/monitoring volume buckets.

type Bucket = {
  date: string;
  dateLabel: string;
  ok: number;
  blocked: number;
  error: number;
};

export const hasNoGatewayTraffic = (data: readonly Bucket[] | null): boolean => {
  if (data === null) return false;
  let total = 0;
  for (const b of data) total += b.ok + b.blocked + b.error;
  return total === 0;
};

const chartConfig: ChartConfig = {
  ok: { label: STATUS_LABELS.ok, color: STATUS_COLORS.ok },
  blocked: { label: STATUS_LABELS.blocked_by_policy, color: STATUS_COLORS.blocked_by_policy },
  error: { label: STATUS_LABELS.origin_error, color: STATUS_COLORS.origin_error },
};

const SERIES_KEYS = ['ok', 'blocked', 'error'] as const;

// Drop series with no events in the window, flat zero-lines just clutter
// the chart + legend. Empty state covers the "everything zero" case.
const activeSeries = (data: readonly Bucket[] | null): readonly (typeof SERIES_KEYS)[number][] => {
  if (!data || data.length === 0) return SERIES_KEYS;
  return SERIES_KEYS.filter((k) => data.some((b) => b[k] > 0));
};

export const ChartAreaInteractive = () => {
  // null = "let server auto-pick the smallest range that contains data" -
  // same auto-range UX as Monitoring + Audit.
  const [range, setRange] = React.useState<MonitoringRange | null>(null);
  const [data, setData] = React.useState<Bucket[] | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const url = range ? `/api/monitoring?range=${range}` : '/api/monitoring';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const body = (await res.json()) as { range: MonitoringRange; volume: Bucket[] };
        if (cancelled) return;
        setData(body.volume);
        if (range === null) setRange(body.range);
      } catch {
        if (!cancelled && range !== null) setData([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range, refreshTick]);

  React.useEffect(() => {
    const onRefresh = () => setRefreshTick((n) => n + 1);
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, []);

  const handleRangeChange = (value: string) => {
    if (!value) return;
    if (isMonitoringRange(value)) setRange(value);
  };

  const hasNoTraffic = hasNoGatewayTraffic(data);
  const series = activeSeries(data);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Gateway Traffic</CardTitle>
        <CardDescription>Calls over time, split by outcome</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range ?? ''}
            onValueChange={handleRangeChange}
            variant="outline"
            size="sm"
          >
            {MONITORING_RANGES.map((r) => (
              <ToggleGroupItem key={r} value={r} className="px-3">
                {RANGE_LABEL[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="relative">
          <ChartContainer
            config={chartConfig}
            className={`aspect-auto h-[250px] w-full ${
              hasNoTraffic ? 'pointer-events-none opacity-25' : ''
            }`}
          >
            <LineChart data={data ?? []} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="dateLabel"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={24}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((k) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={`var(--color-${k})`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
          {hasNoTraffic ? (
            <div
              data-testid="chart-empty-state"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
            >
              <p className="text-sm font-medium">No gateway traffic yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Run a preset in the{' '}
                <a
                  href="/dashboard/playground"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Playground
                </a>{' '}
               , calls will land here once the gateway sees traffic.
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
