'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { volumeChartConfig } from '@/lib/charts/palette';

type VolumeRow = {
  date: string;
  dateLabel: string;
  ok: number;
  blocked: number;
  error: number;
};

type Props = { series: VolumeRow[]; emptyLabel?: string };

export const MonitoringVolumeChart = ({ series, emptyLabel }: Props) => {
  const total = series.reduce((s, b) => s + b.ok + b.blocked + b.error, 0);
  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {emptyLabel ?? 'No gateway traffic in this window.'}
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ChartContainer config={volumeChartConfig} className="aspect-auto h-64 w-full">
        <BarChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="ok" stackId="1" fill="var(--color-ok)" radius={[0, 0, 0, 0]} maxBarSize={44} />
          <Bar dataKey="blocked" stackId="1" fill="var(--color-blocked)" maxBarSize={44} />
          <Bar dataKey="error" stackId="1" fill="var(--color-error)" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ChartContainer>
    </div>
  );
};
