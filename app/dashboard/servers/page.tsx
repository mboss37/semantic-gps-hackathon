import { createClient } from '@/lib/supabase/server';
import { ImportDialog } from '@/components/dashboard/import-dialog';
import { ServerCard } from '@/components/dashboard/server-card';

export const dynamic = 'force-dynamic';

type ServerRow = {
  id: string;
  name: string;
  origin_url: string | null;
  transport: string;
  created_at: string;
};

const ServersPage = async () => {
  const supabase = await createClient();
  const [serversRes, toolsRes] = await Promise.all([
    supabase
      .from('servers')
      .select('id, name, origin_url, transport, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('tools').select('server_id'),
  ]);

  const servers = (serversRes.data ?? []) as ServerRow[];
  const toolCounts = new Map<string, number>();
  for (const t of toolsRes.data ?? []) {
    const key = t.server_id as string | null;
    if (!key) continue;
    toolCounts.set(key, (toolCounts.get(key) ?? 0) + 1);
  }

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
          {servers.map((s) => (
            <ServerCard
              key={s.id}
              id={s.id}
              name={s.name}
              transport={s.transport}
              originUrl={s.origin_url}
              createdAt={s.created_at}
              toolCount={toolCounts.get(s.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServersPage;
