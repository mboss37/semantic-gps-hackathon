'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { verdictChartConfig } from '@/lib/charts/palette';

// Sprint 12 WP-12.4 (I.4): per-policy shadow→enforce timeline chart. Stacks
// enforce_block (red) + shadow_block (amber) + allow (emerald) per day so the
// judge can see at a glance how often this policy would have fired. Amber
// bars are the shadow-mode "would-have-blocked" events — the core auditing
// story we're pitching.

type Bucket = {
  date: string;
  enforce_block: number;
  shadow_block: number;
  allow: number;
};

type TimelineResponse = {
  policy_id: string;
  policy_name: string;
  days: number;
  series: Bucket[];
};

type Props = { policyId: string; days?: number };

const formatDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

export const PolicyTimelineChart = ({ policyId, days = 7 }: Props) => {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/policies/${policyId}/timeline?days=${days}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as TimelineResponse;
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [policyId, days]);

  if (loading) {
    return (
      <div className="h-80 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Loading timeline…
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-80 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
        Failed to load timeline: {error}
      </div>
    );
  }
  if (!data) return null;

  const totalEvents = data.series.reduce(
    (sum, b) => sum + b.enforce_block + b.shadow_block + b.allow,
    0,
  );
  if (totalEvents === 0) {
    return (
      <div className="h-80 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <p>No events in the last {data.days} days — this policy hasn&apos;t fired yet.</p>
        <p className="mt-1">Run a Playground preset to populate.</p>
      </div>
    );
  }

  const chartData = data.series.map((b) => ({ ...b, dateLabel: formatDate(b.date) }));

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <ChartContainer config={verdictChartConfig} className="aspect-auto h-80 w-full">
        <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="allow" stackId="1" fill="var(--color-allow)" maxBarSize={44} />
          <Bar dataKey="shadow_block" stackId="1" fill="var(--color-shadow_block)" maxBarSize={44} />
          <Bar
            dataKey="enforce_block"
            stackId="1"
            fill="var(--color-enforce_block)"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
};
