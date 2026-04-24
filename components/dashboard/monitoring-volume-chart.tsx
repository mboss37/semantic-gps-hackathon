'use client';

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
import type { CallVolumeBucket } from '@/lib/monitoring/fetch';

type Props = { series: CallVolumeBucket[] };

const formatDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

export const MonitoringVolumeChart = ({ series }: Props) => {
  const total = series.reduce((s, b) => s + b.ok + b.blocked + b.error, 0);
  if (total === 0) {
    return (
      <div className="h-64 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
        No gateway traffic in the last 7 days.
      </div>
    );
  }
  const data = series.map((b) => ({ ...b, dateLabel: formatDate(b.date) }));
  return (
    <div className="h-64 rounded-lg border bg-muted/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
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
          <Bar dataKey="ok" stackId="1" fill="var(--chart-2)" name="Allowed" />
          <Bar dataKey="blocked" stackId="1" fill="var(--chart-4)" name="Blocked by policy" />
          <Bar dataKey="error" stackId="1" fill="var(--chart-3)" name="Upstream / internal error" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
