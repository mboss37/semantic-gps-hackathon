'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PolicyBlockBucket } from '@/lib/monitoring/fetch';

const PALETTE = ['#3b82f6', '#a855f7', '#14b8a6', '#f59e0b', '#ef4444', '#71717a'];
const TOP_N = 5;
const OTHER_KEY = '__other';

type Props = { series: PolicyBlockBucket[] };

const formatDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

type Row = { date: string; dateLabel: string } & Record<string, number | string>;

export const MonitoringBlocksChart = ({ series }: Props) => {
  const { rows, policyKeys } = useMemo(() => buildRows(series), [series]);
  const totals = rows.reduce(
    (sum, r) => sum + policyKeys.reduce((s, k) => s + ((r[k] as number) ?? 0), 0),
    0,
  );
  if (totals === 0) {
    return (
      <div className="h-64 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
        No policy blocks in the last 7 days.
      </div>
    );
  }

  return (
    <div className="h-64 rounded-lg border bg-muted/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="dateLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {policyKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="1"
              fill={PALETTE[idx % PALETTE.length]}
              name={key === OTHER_KEY ? 'other' : key}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const buildRows = (series: PolicyBlockBucket[]): { rows: Row[]; policyKeys: string[] } => {
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
    const row: Row = { date: bucket.date, dateLabel: formatDate(bucket.date) };
    for (const key of top) row[key] = bucket.byPolicy[key] ?? 0;
    if (hasOther) {
      let otherTotal = 0;
      for (const name of rest) otherTotal += bucket.byPolicy[name] ?? 0;
      row[OTHER_KEY] = otherTotal;
    }
    return row;
  });
  return { rows, policyKeys };
};
