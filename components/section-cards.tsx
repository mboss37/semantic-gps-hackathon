import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Sprint 21 WP-21.2: status badges color-coded by signal type. Generic
// "outline" Badge variant looked uniform — judges couldn't tell at-a-glance
// which numbers were healthy, governed, or trending. Each kind now has its
// own tint: emerald for live infra, sky for discoverable surface, indigo
// for governance, neutral for steady, and trend-direction colors for the
// 24h delta.

type Props = {
  serverCount: number;
  toolCount: number;
  policyCount: number;
  eventCount24h: number;
  eventCountPrev24h: number;
};

const deltaPercent = (curr: number, prev: number): number => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
};

const tintedPill =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium';

export function SectionCards({
  serverCount,
  toolCount,
  policyCount,
  eventCount24h,
  eventCountPrev24h,
}: Props) {
  const delta = deltaPercent(eventCount24h, eventCountPrev24h);
  const up = delta >= 0;
  const TrendIcon = up ? TrendingUpIcon : TrendingDownIcon;
  const trendClass = up
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>MCP Servers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {serverCount}
          </CardTitle>
          <CardAction>
            <span
              className={`${tintedPill} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}
            >
              Active
            </span>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Connected MCP endpoints
          </div>
          <div className="text-muted-foreground">Registered in the gateway</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Tools Registered</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {toolCount}
          </CardTitle>
          <CardAction>
            <span
              className={`${tintedPill} border-sky-500/30 bg-sky-500/10 text-sky-300`}
            >
              Discoverable
            </span>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Tools across all servers
          </div>
          <div className="text-muted-foreground">Available via MCP manifest</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Policies</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {policyCount}
          </CardTitle>
          <CardAction>
            <span
              className={`${tintedPill} border-indigo-500/30 bg-indigo-500/10 text-indigo-300`}
            >
              Enforced
            </span>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            PII redaction + allowlists
          </div>
          <div className="text-muted-foreground">Applied on every request</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Events (24h)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {eventCount24h}
          </CardTitle>
          <CardAction>
            <span className={`${tintedPill} ${trendClass}`}>
              <TrendIcon className="size-3.5" />
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {up ? 'Traffic up' : 'Traffic down'} vs previous 24h{' '}
            <TrendIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Total gateway events</div>
        </CardFooter>
      </Card>
    </div>
  );
}
