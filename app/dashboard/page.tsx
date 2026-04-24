import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { SectionCards } from '@/components/section-cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { auditEventSchema, type AuditEvent } from '@/lib/schemas/audit-event';

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

  // Sprint 15 smoke-test finding: every card + recent-events query here used
  // to fetch cross-org. Now all 6 queries filter by the caller's org. The
  // old `.eq('is_active', true)` on policies was also dead (no such column);
  // "Active Policies" now counts every policy assigned in the org — that's
  // the operational definition the card title implies.
  const { supabase, organization_id } = ctx;
  const { dayAgo, twoDaysAgo } = timeWindow();

  // Pull the org's server_ids once so every downstream query that needs to
  // filter by server can reuse the same IN-list without re-hitting servers.
  const { data: orgServers } = await supabase
    .from('servers')
    .select('id')
    .eq('organization_id', organization_id);
  const serverIds = (orgServers ?? []).map((s) => s.id);

  const [
    serversRes,
    toolsRes,
    policiesRes,
    events24hRes,
    eventsPrev24hRes,
    recentRes,
  ] = await Promise.all([
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
    supabase
      .from('mcp_events')
      .select(
        'id, trace_id, server_id, tool_name, method, status, latency_ms, created_at, policy_decisions',
      )
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const events: AuditEvent[] = (recentRes.data ?? [])
    .map((row) => {
      const parsed = auditEventSchema.safeParse(row);
      return parsed.success ? parsed.data : null;
    })
    .filter((e): e is AuditEvent => e !== null);

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
        {events.length === 0 ? (
          <div className="px-4 lg:px-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent events</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  No gateway events yet. Every MCP call that passes through Semantic GPS shows
                  up here — policy decisions, latency, trace IDs, the lot.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/dashboard/playground">Open Playground</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/servers">Register an MCP server</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <DataTable data={events} />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
