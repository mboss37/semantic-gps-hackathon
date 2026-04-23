"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export const description = "Gateway traffic area chart";

// Sprint 14 WP-14.1: backed by /api/gateway-traffic. Live aggregation over
// mcp_events replaces the 2024 fixture this shadcn template shipped with.
// Palette matches components/dashboard/monitoring-volume-chart.tsx so the
// dashboard overview and the monitoring page tell the same visual story.

type Bucket = {
  date: string;
  ok: number;
  blocked: number;
  error: number;
};

type Range = "7d" | "30d" | "90d";

const isRange = (value: string): value is Range =>
  value === "7d" || value === "30d" || value === "90d";

const chartConfig = {
  events: { label: "Events" },
  ok: { label: "OK", color: "#22c55e" },
  blocked: { label: "Blocked", color: "#ef4444" },
  error: { label: "Error", color: "#f59e0b" },
} satisfies ChartConfig;

export const ChartAreaInteractive = () => {
  const isMobile = useIsMobile();
  const [userRange, setUserRange] = React.useState<Range | null>(null);
  const timeRange: Range = userRange ?? (isMobile ? "7d" : "90d");
  const [data, setData] = React.useState<Bucket[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/gateway-traffic?range=${timeRange}`);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const body = (await res.json()) as { series: Bucket[] };
        if (!cancelled) setData(body.series);
      } catch {
        if (!cancelled) setData([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const handleRangeChange = (value: string) => {
    if (isRange(value)) setUserRange(value);
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Gateway Traffic</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Calls over time, split by outcome
          </span>
          <span className="@[540px]/card:hidden">Outcome over time</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => {
              if (v) handleRangeChange(v);
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={handleRangeChange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a range"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={data ?? []}>
            <defs>
              <linearGradient id="fillOk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-ok)" stopOpacity={0.9} />
                <stop offset="95%" stopColor="var(--color-ok)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillBlocked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-blocked)" stopOpacity={0.9} />
                <stop offset="95%" stopColor="var(--color-blocked)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillError" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.9} />
                <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="ok"
              type="natural"
              fill="url(#fillOk)"
              stroke="var(--color-ok)"
              stackId="a"
            />
            <Area
              dataKey="blocked"
              type="natural"
              fill="url(#fillBlocked)"
              stroke="var(--color-blocked)"
              stackId="a"
            />
            <Area
              dataKey="error"
              type="natural"
              fill="url(#fillError)"
              stroke="var(--color-error)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
