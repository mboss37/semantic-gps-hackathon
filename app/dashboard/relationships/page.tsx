import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRightIcon } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { RelationshipCreateDialog } from '@/components/dashboard/relationship-create-dialog';
import { RelationshipRow } from '@/components/dashboard/relationship-row';
import { RelationshipsFilterBar } from '@/components/dashboard/relationships-filter-bar';
import { EDGE_STYLES } from '@/components/dashboard/graph-legend';

export const dynamic = 'force-dynamic';

// Sprint 27 redesign: server-grouped edge list, monogram chips, glyph + arrow
// edge connector, description on row 2. Filters via URL state. Visualisation
// of the same data lives at /dashboard/graph.

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

type SearchParamsShape = { type?: string; server?: string; q?: string };

const RelationshipsPage = async ({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsShape>;
}) => {
  const params = (await searchParams) ?? {};
  const filterType = params.type;
  const filterServer = params.server;
  const filterQ = (params.q ?? '').toLowerCase();

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
  const toolMetaById = new Map(
    tools.map((t) => [
      t.id,
      {
        toolName: t.name,
        serverId: t.server_id,
        serverName: t.servers?.name ?? 'unknown server',
      },
    ]),
  );

  let allRelationships: RelationshipRecord[] = [];
  if (tools.length > 0) {
    const toolIds = tools.map((t) => t.id);
    const { data: relsData } = await supabase
      .from('relationships')
      .select('id, from_tool_id, to_tool_id, relationship_type, description')
      .in('from_tool_id', toolIds)
      .in('to_tool_id', toolIds);
    allRelationships = (relsData ?? []) as RelationshipRecord[];
  }

  // Apply filters server-side so deep-links land on filtered state without
  // a client round-trip flash.
  const filtered = allRelationships.filter((r) => {
    if (filterType && filterType !== r.relationship_type) return false;
    const fromMeta = toolMetaById.get(r.from_tool_id);
    if (filterServer && fromMeta?.serverId !== filterServer) return false;
    if (filterQ.length > 0) {
      const haystack = `${fromMeta?.toolName ?? ''} ${
        toolMetaById.get(r.to_tool_id)?.toolName ?? ''
      } ${r.description}`.toLowerCase();
      if (!haystack.includes(filterQ)) return false;
    }
    return true;
  });

  // Group filtered edges by from-server for the section headers.
  type ServerGroup = {
    serverId: string;
    serverName: string;
    rels: RelationshipRecord[];
  };
  const groupsByServer = new Map<string, ServerGroup>();
  for (const r of filtered) {
    const fromMeta = toolMetaById.get(r.from_tool_id);
    if (!fromMeta) continue;
    const existing = groupsByServer.get(fromMeta.serverId);
    if (existing) {
      existing.rels.push(r);
    } else {
      groupsByServer.set(fromMeta.serverId, {
        serverId: fromMeta.serverId,
        serverName: fromMeta.serverName,
        rels: [r],
      });
    }
  }
  const groups = Array.from(groupsByServer.values()).sort((a, b) =>
    a.serverName.localeCompare(b.serverName),
  );

  const serverOptions = Array.from(
    new Map(
      tools.map((t) => [t.server_id, { id: t.server_id, name: t.servers?.name ?? 'unknown' }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const hasAnyEdges = allRelationships.length > 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relationships</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Typed edges the gateway uses for workflow discovery, fallbacks, and saga rollback.{' '}
            <Link
              href="/dashboard/graph"
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
            >
              Visualize on Graph
              <ArrowUpRightIcon className="size-3" />
            </Link>
          </p>
        </div>
        <RelationshipCreateDialog tools={toolOptions} />
      </header>

      {hasAnyEdges ? (
        <Suspense
          fallback={
            <div className="h-12 rounded-lg border bg-card/30" aria-hidden />
          }
        >
          <RelationshipsFilterBar
            servers={serverOptions}
            totalEdges={allRelationships.length}
            filteredEdges={filtered.length}
          />
        </Suspense>
      ) : null}

      {!hasAnyEdges ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No edges match the current filters.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <ServerSection
              key={g.serverId}
              serverId={g.serverId}
              serverName={g.serverName}
              edgeCount={g.rels.length}
            >
              <ul className="divide-y divide-border/40 rounded-lg border bg-card/30">
                {g.rels.map((r) => (
                  <li key={r.id}>
                    <RelationshipRow
                      id={r.id}
                      from={toolMetaById.get(r.from_tool_id) ?? null}
                      to={toolMetaById.get(r.to_tool_id) ?? null}
                      relationshipType={r.relationship_type}
                      description={r.description}
                    />
                  </li>
                ))}
              </ul>
            </ServerSection>
          ))}
        </div>
      )}
    </div>
  );
};

type ServerSectionProps = {
  serverId: string;
  serverName: string;
  edgeCount: number;
  children: React.ReactNode;
};

const ServerSection = ({ serverName, edgeCount, children }: ServerSectionProps) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-baseline gap-2 px-1">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {serverName}
      </h2>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
        {edgeCount} edge{edgeCount === 1 ? '' : 's'}
      </span>
    </div>
    {children}
  </section>
);

const EmptyState = () => (
  <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
    <h2 className="text-sm font-medium">No relationships connected yet</h2>
    <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
      Wire your first edge to power workflow discovery, automatic fallbacks, and saga rollback.
      The 8 canonical types let you express precedence, dependency, validation, and recovery
      paths between any two tools.
    </p>
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      <Link
        href="/dashboard/graph"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        See examples on Graph
        <ArrowUpRightIcon className="size-3" />
      </Link>
    </div>
    <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
      {Object.entries(EDGE_STYLES)
        .slice(0, 4)
        .map(([key, s]) => {
          const Icon = s.icon;
          return (
            <div
              key={key}
              className="rounded-md border bg-background/40 p-2"
              title={s.description}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="size-3" style={{ color: s.stroke }} />
                <span className="font-mono text-[10px]">{s.label}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                {s.description}
              </p>
            </div>
          );
        })}
    </div>
  </div>
);

export default RelationshipsPage;
