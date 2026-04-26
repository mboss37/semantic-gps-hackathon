'use client';

import { useEffect, useState } from 'react';

import { MonitoringBlocksChart } from '@/components/dashboard/monitoring-blocks-chart';
import { MonitoringKpiStrip, type MonitoringKpisProps } from '@/components/dashboard/monitoring-kpi-strip';
import { MonitoringPiiChart } from '@/components/dashboard/monitoring-pii-chart';
import { MonitoringVolumeChart } from '@/components/dashboard/monitoring-volume-chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DASHBOARD_REFRESH_EVENT } from '@/hooks/use-dashboard-refresh';
import {
  MONITORING_RANGES,
  RANGE_LABEL,
  isMonitoringRange,
  type MonitoringRange,
} from '@/lib/monitoring/range';

type VolumeBucket = {
  date: string;
  dateLabel: string;
  ok: number;
  blocked: number;
  error: number;
};

type BlockBucket = {
  date: string;
  dateLabel: string;
  byPolicy: Record<string, number>;
};

type PiiCount = { pattern: string; count: number };

type MonitoringResponse = {
  range: MonitoringRange;
  volume: VolumeBucket[];
  blocks: BlockBucket[];
  pii: PiiCount[];
  kpis: MonitoringKpisProps;
};

const ZERO_KPIS: MonitoringKpisProps = {
  current: { totalCalls: 0, errorRate: 0, blockRate: 0, p95LatencyMs: 0 },
  prior: { totalCalls: 0, errorRate: 0, blockRate: 0, p95LatencyMs: 0 },
};

const RANGE_DESCRIPTION: Record<MonitoringRange, string> = {
  '15m': 'Last 15 minutes · 1-min buckets',
  '30m': 'Last 30 minutes · 1-min buckets',
  '1h': 'Last hour · 2-min buckets',
  '6h': 'Last 6 hours · 15-min buckets',
  '24h': 'Last 24 hours · 1-hour buckets',
  '7d': 'Last 7 days · 1-day buckets',
};

const EMPTY_VOLUME = `No gateway traffic in this window.`;
const EMPTY_BLOCKS = `No policy blocks in this window.`;
const EMPTY_PII = `No PII detections in this window.`;

export const MonitoringDashboard = () => {
  // null = "let server auto-pick the smallest range that contains data".
  const [range, setRange] = useState<MonitoringRange | null>(null);
  const [data, setData] = useState<MonitoringResponse | null>(null);
  // Bumped by the dashboard-refresh window event to retrigger the fetch
  // effect without changing the picked range.
  const [refreshTick, setRefreshTick] = useState(0);
  // Derive loading from data freshness, avoids setState-in-effect, and the
  // chart switches the moment the response for the picked range lands.
  const loading = data === null || (range !== null && data.range !== range);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const url = range ? `/api/monitoring?range=${range}` : `/api/monitoring`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const body = (await res.json()) as MonitoringResponse;
        if (cancelled) return;
        setData(body);
        if (range === null) setRange(body.range);
      } catch {
        if (!cancelled && range !== null) {
          setData({ range, volume: [], blocks: [], pii: [], kpis: ZERO_KPIS });
        }
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

  const handleRangeChange = (value: string) => {
    if (!value) return;
    if (isMonitoringRange(value)) setRange(value);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monitoring</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {range ? RANGE_DESCRIPTION[range] : 'Auto-selecting range…'} · live from{' '}
            <code className="text-zinc-300">mcp_events</code>.
          </p>
        </div>
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
      </header>

      <section className="@container/main">
        <MonitoringKpiStrip {...(data?.kpis ?? ZERO_KPIS)} />
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Call volume</h2>
          <p className="text-xs text-zinc-500">Allowed / blocked / error per bucket.</p>
        </div>
        {loading && data === null ? (
          <div className="h-64 rounded-lg border bg-muted/30" />
        ) : (
          <MonitoringVolumeChart series={data?.volume ?? []} emptyLabel={EMPTY_VOLUME} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Policy violations over time</h2>
          <p className="text-xs text-zinc-500">
            Stacks per-policy blocks (shadow + enforce). Top 5 by total; rest merged as
            &ldquo;other&rdquo;.
          </p>
        </div>
        {loading && data === null ? (
          <div className="h-64 rounded-lg border bg-muted/30" />
        ) : (
          <MonitoringBlocksChart series={data?.blocks ?? []} emptyLabel={EMPTY_BLOCKS} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">PII detections by pattern</h2>
          <p className="text-xs text-zinc-500">
            Counts per pattern emitted by the redaction runner (phone, email, ssn, …).
          </p>
        </div>
        {loading && data === null ? (
          <div className="h-64 rounded-lg border bg-muted/30" />
        ) : (
          <MonitoringPiiChart data={data?.pii ?? []} emptyLabel={EMPTY_PII} />
        )}
      </section>
    </div>
  );
};
