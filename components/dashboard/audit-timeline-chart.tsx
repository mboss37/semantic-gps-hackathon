'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { STATUS_COLORS, STATUS_LABELS, type AuditStatus } from '@/lib/charts/palette';
import {
  AUDIT_TIMELINE_STATUS_KEYS,
  type AuditTimelineBucket,
} from '@/lib/audit/timeline';

const auditTimelineConfig: ChartConfig = AUDIT_TIMELINE_STATUS_KEYS.reduce((acc, k) => {
  acc[k] = { label: STATUS_LABELS[k as AuditStatus], color: STATUS_COLORS[k as AuditStatus] };
  return acc;
}, {} as ChartConfig);

type Props = { series: AuditTimelineBucket[] };

export const AuditTimelineChart = ({ series }: Props) => {
  const total = series.reduce(
    (s, b) =>
      s +
      b.ok +
      b.blocked_by_policy +
      b.origin_error +
      b.fallback_triggered +
      b.rollback_executed,
    0,
  );
  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        No events in this window.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ChartContainer config={auditTimelineConfig} className="aspect-auto h-48 w-full">
        <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickMargin={8}
            minTickGap={32}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <ChartLegend content={<ChartLegendContent />} />
          {AUDIT_TIMELINE_STATUS_KEYS.map((k) => (
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
    </div>
  );
};
