'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Datum = { status: string; count: number };

export const AuditChart = ({ data }: { data: Datum[] }) => {
  if (data.length === 0) return null;
  return (
    <div className="h-40 rounded-lg border bg-muted/30 p-4">
      <p className="mb-2 text-xs text-muted-foreground">Events by status (current page)</p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
