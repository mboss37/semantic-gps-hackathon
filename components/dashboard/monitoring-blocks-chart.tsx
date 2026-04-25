'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { buildPolicyChartConfig } from '@/lib/charts/palette';

const TOP_N = 5;
const OTHER_KEY = '__other';

type BlockBucket = {
  date: string;
  dateLabel: string;
  byPolicy: Record<string, number>;
};

type Props = { series: BlockBucket[]; emptyLabel?: string };

type Row = { date: string; dateLabel: string } & Record<string, number | string>;

export const MonitoringBlocksChart = ({ series, emptyLabel }: Props) => {
  const { rows, policyKeys, hasOther } = useMemo(() => buildRows(series), [series]);
  const config = useMemo(() => {
    const named = policyKeys.filter((k) => k !== OTHER_KEY);
    return buildPolicyChartConfig(named, hasOther ? OTHER_KEY : undefined);
  }, [policyKeys, hasOther]);

  const totals = rows.reduce(
    (sum, r) => sum + policyKeys.reduce((s, k) => s + ((r[k] as number) ?? 0), 0),
    0,
  );
  if (totals === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {emptyLabel ?? 'No policy blocks in this window.'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          {policyKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="1"
              fill={`var(--color-${key})`}
              maxBarSize={44}
              radius={idx === policyKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
};

const buildRows = (
  series: BlockBucket[],
): { rows: Row[]; policyKeys: string[]; hasOther: boolean } => {
  const totals = new Map<string, number>();
  for (const bucket of series) {
    for (const [name, count] of Object.entries(bucket.byPolicy)) {
      totals.set(name, (totals.get(name) ?? 0) + count);
    }
  }
  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, TOP_N).map(([name]) => name);
  const rest = ranked.slice(TOP_N).map(([name]) => name);
  const hasOther = rest.length > 0;
  const policyKeys = hasOther ? [...top, OTHER_KEY] : top;

  const rows: Row[] = series.map((bucket) => {
    const row: Row = { date: bucket.date, dateLabel: bucket.dateLabel };
    for (const key of top) row[key] = bucket.byPolicy[key] ?? 0;
    if (hasOther) {
      let otherTotal = 0;
      for (const name of rest) otherTotal += bucket.byPolicy[name] ?? 0;
      row[OTHER_KEY] = otherTotal;
    }
    return row;
  });
  return { rows, policyKeys, hasOther };
};
