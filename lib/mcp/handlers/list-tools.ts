import type { Manifest, ManifestScope } from '@/lib/manifest/cache';
import {
  buildRoutesByToolId,
  formatToolDescription,
  type FormatToolDescriptionEdge,
} from '@/lib/manifest/format-description';
import { buildExecuteRouteToolDescriptor } from '@/lib/mcp/execute-route-tool';
import { buildCatalog } from '@/lib/mcp/tool-dispatcher';
import { TREL_EDGE_TYPES } from '@/lib/mcp/trel-schema';

// `tools/list` response builder. Pure function — every dependency is passed
// in, no IO, no logging. Extracted from `stateless-server.ts` to keep the
// wiring shell under the file-size cap. The wrapper in stateless-server is
// responsible for logMCPEvent + latency measurement so this stays trivially
// testable in isolation.
//
// Behavior:
//   - Builds the catalog (builtin echo + manifest tools).
//   - On governed surfaces: rewrites display names, folds outgoing TRel edges
//     and parent-route memberships into the standard `description` field
//     (every MCP client preserves description; `_meta` is empirically
//     stripped consumer-side), still emits the `_meta.trel` sidecar for
//     forward compat, surfaces the synthetic `execute_route` tool.
//   - On ungoverned surfaces: leaves origin name/description untouched, no
//     edges, no synthetic tool. The Playground A/B contrast lives or dies on
//     this distinction; do NOT leak governed enrichment into the raw path.

type ToolListEntry = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

export const buildToolsListResponse = (opts: {
  manifest: Manifest;
  scope: ManifestScope;
  governed: boolean;
}): { tools: ToolListEntry[] } => {
  const { manifest, scope, governed } = opts;
  const catalog = buildCatalog(manifest);

  // Build a tool-id -> manifest row map once so every lookup (outgoing
  // edges + semantic rewriting) is O(1). `_meta.relationships` is the TRel
  // sidecar that lets callers (Claude + orchestrators) see adjacency hints
  // without a second round-trip through `discover_relationships`. Skipped
  // on ungoverned surfaces, raw MCPs don't expose graph context.
  const manifestRowById = new Map<string, (typeof manifest.tools)[number]>();
  for (const t of manifest.tools) manifestRowById.set(t.id, t);

  // Display name for outgoing edge targets: use `display_name` when set,
  // fall back to the origin `name`, keeps edge labels consistent with the
  // rewriting layer below.
  const displayNameById = new Map<string, string>();
  for (const t of manifest.tools) displayNameById.set(t.id, t.display_name ?? t.name);

  // Sprint 30 WP-30.2: pre-compute parent-route memberships per tool so the
  // description formatter can fold "Part of route: ..." badges into the
  // standard description field. Standard MCP clients drop `_meta` entirely;
  // the description is the only field with provably 100% client coverage.
  const routesByToolId = buildRoutesByToolId(manifest);

  const tools: ToolListEntry[] = catalog.map((t) => {
    // WP-G.6 semantic rewriting: if the manifest row carries
    // `display_name` / `display_description`, surface those on `tools/list`
    // instead of the origin name/description. Dispatch in `tools/call`
    // still looks up by origin `name` (see buildCatalog), so upstream
    // contracts stay stable. Ungoverned surfaces stay with origin identity.
    const manifestRow = manifestRowById.get(t.tool_id);
    const displayName = governed ? (manifestRow?.display_name ?? t.name) : t.name;

    // Schema-lock guard: only emit edge types the `_meta.trel` SEP draft
    // declares. The DB CHECK constraint accepts the broader internal set
    // (incl. linter-only `mutually_exclusive` / `validates`); those types
    // are deliberately scoped out of the wire shape and must never reach
    // a client. Any drift between the DB taxonomy and the wire schema is
    // closed here.
    const wireTypeSet = TREL_EDGE_TYPES as readonly string[];
    const outgoing: FormatToolDescriptionEdge[] = governed
      ? manifest.relationships
          .filter((r) => r.from_tool_id === t.tool_id)
          .filter((r) => wireTypeSet.includes(r.relationship_type))
          .map((r): FormatToolDescriptionEdge | null => {
            const to = displayNameById.get(r.to_tool_id);
            if (!to) return null;
            return { to, type: r.relationship_type, description: r.description };
          })
          .filter((r): r is FormatToolDescriptionEdge => r !== null)
      : [];

    // Sprint 30: only enrich when (a) governed, (b) there's no manual
    // `display_description` override (manual override always wins),
    // (c) the tool has a manifest row to anchor the graph against.
    // Builtin echo + ungoverned surfaces fall through to origin description.
    const manualOverride = governed ? (manifestRow?.display_description ?? null) : null;
    const parentRoutes = governed ? (routesByToolId.get(t.tool_id) ?? []) : [];
    const description =
      governed && !manualOverride && manifestRow
        ? formatToolDescription({
            tool: { name: displayName, description: t.description },
            outgoingEdges: outgoing,
            parentRoutes,
            scope: scope.kind,
          })
        : (manualOverride ?? t.description);

    const base: ToolListEntry = {
      name: displayName,
      description,
      inputSchema: t.input_schema,
    };

    if (governed && outgoing.length > 0) {
      base._meta = { relationships: outgoing };
    }

    return base;
  });

  // Sprint 31 WP-31.1: surface a synthetic `execute_route` tool so standard
  // MCP clients can invoke saga orchestration through the same `tools/call`
  // surface they use for any other tool. Sprint 30 description enrichment
  // recommends `execute_route('<name>')` to the model; without this shim
  // the recommendation is a dead end — clients cannot call arbitrary
  // JSON-RPC methods, only what is in `tools/list`. The native
  // `ExecuteRouteRequestSchema` JSON-RPC method below stays for backward
  // compat with custom orchestrators. Skipped on ungoverned surfaces +
  // when no routes exist (nothing to execute).
  if (governed) {
    const syntheticExecuteRoute = buildExecuteRouteToolDescriptor(
      manifest.routes,
      manifest.route_steps,
      manifest.relationships,
    );
    if (syntheticExecuteRoute) tools.push(syntheticExecuteRoute);
  }

  return { tools };
};
