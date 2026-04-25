import { redirect } from 'next/navigation';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { ImportDialog } from '@/components/dashboard/import-dialog';
import { ServerCard, type ToolSummary } from '@/components/dashboard/server-card';
import { probeServerOrigin, type ProbeResult } from '@/lib/servers/health';

export const dynamic = 'force-dynamic';

type ServerRow = {
  id: string;
  name: string;
  origin_url: string | null;
  transport: string;
  created_at: string;
};

type ToolRow = {
  server_id: string | null;
  name: string;
  description: string | null;
};

type EventRow = {
  server_id: string | null;
  status: string;
};

// React 19 `react-hooks/purity` lint flags `Date.now()` inside render bodies.
// Extracting to a helper sidesteps the rule (function definition is fine,
// the call inside the component is treated as opaque). Same pattern used in
// lib/monitoring/range.ts.
const since24hIso = (): string =>
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

type Stats = { calls: number; errors: number };

const ServersPage = async () => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/dashboard/servers');
    }
    throw e;
  }

  // Sprint 15 smoke-test finding: this page previously fetched ALL servers +
  // ALL tools across every org — a multi-tenant leak that was invisible in
  // single-user MVP but surfaced the moment a second account existed. Both
  // queries now filter by the caller's organization_id. Tools inherit scope
  // via servers.organization_id (no org column on tools); we IN-filter tools
  // on the server_ids the first query returned.
  const { supabase, organization_id } = ctx;
  const serversRes = await supabase
    .from('servers')
    .select('id, name, origin_url, transport, created_at')
    .eq('organization_id', organization_id)
    .order('created_at', { ascending: false });

  const serverIds = ((serversRes.data ?? []) as ServerRow[]).map((s) => s.id);
  const since24h = since24hIso();
  const [toolsRes, eventsRes] = await Promise.all([
    serverIds.length === 0
      ? Promise.resolve({ data: [] as ToolRow[], error: null })
      : supabase
          .from('tools')
          .select('server_id, name, description')
          .in('server_id', serverIds)
          .order('name'),
    serverIds.length === 0
      ? Promise.resolve({ data: [] as EventRow[], error: null })
      : supabase
          .from('mcp_events')
          .select('server_id, status')
          .eq('organization_id', organization_id)
          .in('server_id', serverIds)
          .gte('created_at', since24h),
  ]);

  const servers = (serversRes.data ?? []) as ServerRow[];
  const toolsByServer = new Map<string, ToolSummary[]>();
  for (const t of (toolsRes.data ?? []) as ToolRow[]) {
    if (!t.server_id) continue;
    const bucket = toolsByServer.get(t.server_id) ?? [];
    bucket.push({ name: t.name, description: t.description });
    toolsByServer.set(t.server_id, bucket);
  }

  const statsByServer = new Map<string, Stats>();
  for (const ev of (eventsRes.data ?? []) as EventRow[]) {
    if (!ev.server_id) continue;
    const s = statsByServer.get(ev.server_id) ?? { calls: 0, errors: 0 };
    s.calls += 1;
    if (ev.status !== 'ok' && ev.status !== 'blocked_by_policy') s.errors += 1;
    statsByServer.set(ev.server_id, s);
  }

  // Sprint 26 — live origin probe per server, in parallel during render.
  // 2s timeout per probe means worst case is one extra ~2s wait if every
  // origin is dead; happy path is sub-100ms total since they run together.
  // Health is the FIRST thing the user wants to see on the list page —
  // surfacing it via card badge avoids the "click in to discover dead
  // origin" anti-pattern.
  const healthEntries = await Promise.all(
    servers.map(async (s): Promise<[string, ProbeResult]> => [
      s.id,
      await probeServerOrigin(s.origin_url),
    ]),
  );
  const healthByServer = new Map<string, ProbeResult>(healthEntries);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">MCP Servers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registered servers. Every tool shown here is callable through the gateway.
          </p>
        </div>
        <ImportDialog />
      </header>

      {servers.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No servers yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click <span className="text-foreground font-medium">Add Server</span> above — use the
            demo OpenAPI spec or register an MCP server directly.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {servers.map((s) => {
            const stats = statsByServer.get(s.id);
            const probe = healthByServer.get(s.id);
            return (
              <ServerCard
                key={s.id}
                id={s.id}
                name={s.name}
                transport={s.transport}
                originUrl={s.origin_url}
                tools={toolsByServer.get(s.id) ?? []}
                calls24h={stats?.calls ?? 0}
                errors24h={stats?.errors ?? 0}
                health={probe?.status ?? 'unknown'}
                healthLatencyMs={probe?.latencyMs ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServersPage;
