'use client';

import { useEffect, useState } from 'react';
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

// Sprint 12 WP-12.4 (I.4): per-policy shadow→enforce timeline chart. Stacks
// enforce_block (red) + shadow_block (amber) + allow (muted) per day so the
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
    <div className="h-80 rounded-lg border bg-muted/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
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
          <Bar dataKey="allow" stackId="1" fill="#71717a" name="Allowed" />
          <Bar dataKey="shadow_block" stackId="1" fill="#f59e0b" name="Shadow block (would have)" />
          <Bar dataKey="enforce_block" stackId="1" fill="#ef4444" name="Enforce block" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
