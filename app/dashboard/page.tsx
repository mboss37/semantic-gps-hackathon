import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { DataTable } from '@/components/data-table';
import { SectionCards } from '@/components/section-cards';
import { auditEventSchema, type AuditEvent } from '@/lib/schemas/audit-event';
import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();
  const { dayAgo, twoDaysAgo } = timeWindow();

  const [
    serversRes,
    toolsRes,
    policiesRes,
    events24hRes,
    eventsPrev24hRes,
    recentRes,
  ] = await Promise.all([
    supabase.from('servers').select('id', { count: 'exact', head: true }),
    supabase.from('tools').select('id', { count: 'exact', head: true }),
    supabase
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('mcp_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo),
    supabase
      .from('mcp_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', twoDaysAgo)
      .lt('created_at', dayAgo),
    supabase
      .from('mcp_events')
      .select(
        'id, trace_id, server_id, tool_name, method, status, latency_ms, created_at, policy_decisions',
      )
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
        <DataTable data={events} />
      </div>
    </div>
  );
};

export default DashboardPage;
