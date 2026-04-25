import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActivityIcon, ArrowRightIcon } from 'lucide-react';

import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { SectionCards } from '@/components/section-cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

const timeWindow = () => {
  const now = Date.now();
  return {
    dayAgo: new Date(now - DAY_MS).toISOString(),
    twoDaysAgo: new Date(now - 2 * DAY_MS).toISOString(),
  };
};

const DashboardPage = async () => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/dashboard');
    }
    throw e;
  }

  // Sprint 15 smoke-test finding: every card query used to fetch cross-org.
  // Now all queries filter by the caller's org. The old `.eq('is_active', true)`
  // on policies was dead (no such column); "Active Policies" now counts every
  // policy assigned in the org — that's the operational definition the card
  // title implies.
  // Sprint 25 cleanup — dropped the bottom event DataTable. /dashboard/audit
  // owns the full-fidelity table; overview is for at-a-glance only.
  const { supabase, organization_id } = ctx;
  const { dayAgo, twoDaysAgo } = timeWindow();

  const { data: orgServers } = await supabase
    .from('servers')
    .select('id')
    .eq('organization_id', organization_id);
  const serverIds = (orgServers ?? []).map((s) => s.id);

  const [serversRes, toolsRes, policiesRes, events24hRes, eventsPrev24hRes] = await Promise.all([
    supabase
      .from('servers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id),
    serverIds.length === 0
      ? Promise.resolve({ count: 0, error: null })
      : supabase
          .from('tools')
          .select('id', { count: 'exact', head: true })
          .in('server_id', serverIds),
    supabase
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id),
    supabase
      .from('mcp_events')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .gte('created_at', dayAgo),
    supabase
      .from('mcp_events')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .gte('created_at', twoDaysAgo)
      .lt('created_at', dayAgo),
  ]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards
          serverCount={serversRes.count ?? 0}
          toolCount={toolsRes.count ?? 0}
          policyCount={policiesRes.count ?? 0}
          eventCount24h={events24hRes.count ?? 0}
          eventCountPrev24h={eventsPrev24hRes.count ?? 0}
        />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ActivityIcon className="size-4" />
                  Recent activity
                </CardTitle>
                <CardDescription>
                  Every MCP call that passes through the gateway — policy decisions, latency,
                  trace IDs, full payload context.
                </CardDescription>
              </div>
              <Button asChild variant="secondary">
                <Link href="/dashboard/audit">
                  View full audit
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Filter by status, tool, policy.</span>
                <span aria-hidden>·</span>
                <span>Drill into the redacted payload + trace via row-click.</span>
                <span aria-hidden>·</span>
                <span>Time-range picker (15m → 7d).</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
