'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PiiPatternCount } from '@/lib/monitoring/fetch';

type Props = { data: PiiPatternCount[] };

export const MonitoringPiiChart = ({ data }: Props) => {
  if (data.length === 0) {
    return (
      <div className="h-64 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
        No PII detections in the last 7 days.
      </div>
    );
  }

  return (
    <div className="h-64 rounded-lg border bg-muted/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis type="category" dataKey="pattern" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="count" fill="var(--chart-1)" name="Detections" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
