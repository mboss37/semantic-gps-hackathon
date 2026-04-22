import { createClient } from '@/lib/supabase/server';
import { RelationshipCreateDialog } from '@/components/dashboard/relationship-create-dialog';
import { RelationshipRow } from '@/components/dashboard/relationship-row';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

// Sprint 6 WP-G.2: relationships dashboard. Server Component loads the
// org-scoped edges + tool catalog, then hands everything to client islands
// for the create dialog + per-row edit/delete.

type RelationshipRecord = {
  id: string;
  from_tool_id: string;
  to_tool_id: string;
  relationship_type: string;
  description: string;
};

type ToolWithServer = {
  id: string;
  name: string;
  server_id: string;
  servers: { id: string; name: string; organization_id: string } | null;
};

const RelationshipsPage = async () => {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Sign in to manage relationships.</div>
    );
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();
  const organizationId = membership?.organization_id as string | undefined;
  if (!organizationId) {
    return <div className="p-6 text-sm text-muted-foreground">No organization membership.</div>;
  }

  const { data: toolsData } = await supabase
    .from('tools')
    .select('id, name, server_id, servers!inner(id, name, organization_id)')
    .eq('servers.organization_id', organizationId);

  const tools = (toolsData ?? []) as unknown as ToolWithServer[];
  const toolOptions = tools.map((t) => ({
    id: t.id,
    name: t.name,
    server_id: t.server_id,
    server_name: t.servers?.name ?? 'unknown server',
  }));
  const toolNameById = new Map(tools.map((t) => [t.id, t.name]));

  let relationships: RelationshipRecord[] = [];
  if (tools.length > 0) {
    const toolIds = tools.map((t) => t.id);
    const { data: relsData } = await supabase
      .from('relationships')
      .select('id, from_tool_id, to_tool_id, relationship_type, description')
      .in('from_tool_id', toolIds)
      .in('to_tool_id', toolIds);
    relationships = (relsData ?? []) as RelationshipRecord[];
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relationships</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            TRel edges the gateway uses for workflow discovery, fallbacks, and validation. Double-click a description to edit.
          </p>
        </div>
        <RelationshipCreateDialog tools={toolOptions} />
      </header>

      {relationships.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No relationships yet. Add an edge to power workflow suggestions on the Graph page.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relationships.map((r) => (
                <RelationshipRow
                  key={r.id}
                  id={r.id}
                  fromToolName={toolNameById.get(r.from_tool_id) ?? null}
                  toToolName={toolNameById.get(r.to_tool_id) ?? null}
                  relationshipType={r.relationship_type}
                  description={r.description}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default RelationshipsPage;
