import { createClient } from '@/lib/supabase/server';
import { ImportDialog } from '@/components/dashboard/import-dialog';
import { ServerCard, type ToolSummary } from '@/components/dashboard/server-card';

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

const ServersPage = async () => {
  const supabase = await createClient();
  const [serversRes, toolsRes] = await Promise.all([
    supabase
      .from('servers')
      .select('id, name, origin_url, transport, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('tools').select('server_id, name, description').order('name'),
  ]);

  const servers = (serversRes.data ?? []) as ServerRow[];
  const toolsByServer = new Map<string, ToolSummary[]>();
  for (const t of (toolsRes.data ?? []) as ToolRow[]) {
    if (!t.server_id) continue;
    const bucket = toolsByServer.get(t.server_id) ?? [];
    bucket.push({ name: t.name, description: t.description });
    toolsByServer.set(t.server_id, bucket);
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
              tools={toolsByServer.get(s.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServersPage;
