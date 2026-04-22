import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Props = {
  serverCount: number
  toolCount: number
  policyCount: number
  eventCount24h: number
  eventCountPrev24h: number
}

const deltaPercent = (curr: number, prev: number): number => {
  if (prev === 0) return curr === 0 ? 0 : 100
  return Math.round(((curr - prev) / prev) * 100)
}

export function SectionCards({
  serverCount,
  toolCount,
  policyCount,
  eventCount24h,
  eventCountPrev24h,
}: Props) {
  const delta = deltaPercent(eventCount24h, eventCountPrev24h)
  const up = delta >= 0
  const TrendIcon = up ? TrendingUpIcon : TrendingDownIcon

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>MCP Servers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {serverCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Active</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Connected MCP endpoints
          </div>
          <div className="text-muted-foreground">
            Registered in the gateway
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Tools Registered</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {toolCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Discoverable</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Tools across all servers
          </div>
          <div className="text-muted-foreground">
            Available via MCP manifest
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Policies</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {policyCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Enforced</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            PII redaction + allowlists
          </div>
          <div className="text-muted-foreground">
            Applied on every request
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Events (24h)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {eventCount24h}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendIcon />
              {delta > 0 ? "+" : ""}
              {delta}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {up ? "Traffic up" : "Traffic down"} vs previous 24h{" "}
            <TrendIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total gateway events
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
