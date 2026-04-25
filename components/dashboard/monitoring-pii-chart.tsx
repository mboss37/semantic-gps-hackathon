'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { piiChartConfig } from '@/lib/charts/palette';

type PiiCount = { pattern: string; count: number };

type Props = { data: PiiCount[]; emptyLabel?: string };

export const MonitoringPiiChart = ({ data, emptyLabel }: Props) => {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {emptyLabel ?? 'No PII detections in this window.'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ChartContainer config={piiChartConfig} className="aspect-auto h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            type="category"
            dataKey="pattern"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={96}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" hideLabel />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
    </div>
  );
};
