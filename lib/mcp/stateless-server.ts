import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logMCPEvent, redactPayload } from '@/lib/audit/logger';
import { loadManifest, type ManifestScope } from '@/lib/manifest/cache';
import { buildCatalog, executeTool } from '@/lib/mcp/tool-dispatcher';
import { discoverRelationships, findWorkflowPath } from '@/lib/mcp/trel-handlers';
import {
  DiscoverRelationshipsRequestSchema,
  FindWorkflowPathRequestSchema,
} from '@/lib/mcp/trel-schemas';
import { runPostCallPolicies, runPreCallPolicies } from '@/lib/policies/enforce';

// Low-level Server so tools/list + tools/call can merge the builtin echo with
// whatever the manifest contains at request time. Still stateless: every call
// rebuilds, connects, handles, disposes.

const SERVER_INFO = {
  name: 'semantic-gps-gateway',
  version: '0.1.0',
} as const;

type CreateServerOpts = {
  traceId: string;
  // Manifest scope dictates which servers/tools this gateway instance sees.
  // `org` for the root `/api/mcp`, `domain` for `/api/mcp/domain/[slug]`,
  // `server` for `/api/mcp/server/[id]`.
  scope: ManifestScope;
  // Request metadata threaded into PreCallContext so request-metadata policies
  // (basic_auth, client_id, ip_allowlist) can gate on caller identity. Gateway
  // route extracts headers + infers IP from x-forwarded-for / x-real-ip.
  headers?: Record<string, string>;
  clientIp?: string;
};

export const createStatelessServer = ({ traceId, scope, headers, clientIp }: CreateServerOpts): Server => {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: { listChanged: true } },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const catalog = buildCatalog(manifest);

    // Build a tool-id -> name map once so every outgoing-edge lookup is O(1).
    // `_meta.relationships` is the TRel sidecar that lets callers (Claude +
    // orchestrators) see adjacency hints without a second round-trip through
    // `discover_relationships`.
    const toolNameById = new Map<string, string>();
    for (const t of manifest.tools) toolNameById.set(t.id, t.name);

    const tools = catalog.map((t) => {
      const outgoing = manifest.relationships
        .filter((r) => r.from_tool_id === t.tool_id)
        .map((r) => ({
          to: toolNameById.get(r.to_tool_id) ?? null,
          type: r.relationship_type,
          description: r.description,
        }))
        .filter(
          (r): r is { to: string; type: typeof r.type; description: string } => r.to !== null,
        );

      const base: { name: string; description: string; inputSchema: Record<string, unknown>; _meta?: Record<string, unknown> } = {
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,
      };
      if (outgoing.length > 0) base._meta = { relationships: outgoing };
      return base;
    });

    logMCPEvent({
      trace_id: traceId,
      method: 'tools/list',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: { tool_count: catalog.length },
    });
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const catalog = buildCatalog(manifest);
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    const entry = catalog.find((t) => t.name === name);
    if (!entry) {
      logMCPEvent({
        trace_id: traceId,
        tool_name: name,
        method: 'tools/call',
        status: 'origin_error',
        latency_ms: Math.round(performance.now() - started),
        payload: { reason: 'tool_not_found' },
      });
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool "${name}" is not registered on this gateway.` }],
      };
    }

    if (entry.source === 'builtin' && entry.name === 'echo') {
      const message = typeof args.message === 'string' ? args.message : '';
      const result = { content: [{ type: 'text', text: message }] };
      logMCPEvent({
        trace_id: traceId,
        tool_name: 'echo',
        method: 'tools/call',
        status: 'ok',
        latency_ms: Math.round(performance.now() - started),
        payload: { args: { message }, result },
      });
      return result;
    }

    const policyCtx = {
      server_id: entry.server_id,
      tool_id: entry.tool_id,
      tool_name: entry.name,
      args,
      headers,
      client_ip: clientIp,
    };

    const pre = runPreCallPolicies(policyCtx, manifest);
    if (pre.action === 'block') {
      logMCPEvent({
        trace_id: traceId,
        server_id: entry.server_id,
        tool_name: entry.name,
        method: 'tools/call',
        status: 'blocked_by_policy',
        policy_decisions: pre.decisions,
        latency_ms: Math.round(performance.now() - started),
        payload: { args: redactPayload(args), reason: pre.reason },
      });
      return {
        isError: true,
        content: [{ type: 'text', text: `Blocked by policy: ${pre.reason}` }],
      };
    }

    const execResult = await executeTool(manifest, entry, args, { traceId });
    const post = runPostCallPolicies({ ...policyCtx, result: execResult.result }, manifest);

    // Prefer the upstream latency from the real proxy when available — gives
    // the audit row a pure "time on the wire" measurement instead of the full
    // gateway round-trip (policies + serialization). Falls back to total
    // gateway latency for mock/builtin paths.
    const latencyMs = execResult.upstreamLatencyMs ?? Math.round(performance.now() - started);

    logMCPEvent({
      trace_id: traceId,
      server_id: entry.server_id,
      tool_name: entry.name,
      method: 'tools/call',
      status: execResult.ok ? 'ok' : 'origin_error',
      policy_decisions: [...pre.decisions, ...post.decisions],
      latency_ms: latencyMs,
      payload: { args: redactPayload(args), result: redactPayload(post.result) },
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(post.result, null, 2) }],
    };
  });

  server.setRequestHandler(DiscoverRelationshipsRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const result = await discoverRelationships(req.params, manifest);
    logMCPEvent({
      trace_id: traceId,
      method: 'discover_relationships',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: {
        params: req.params,
        node_count: result.nodes.length,
        edge_count: result.edges.length,
      },
    });
    return result;
  });

  server.setRequestHandler(FindWorkflowPathRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const result = await findWorkflowPath(req.params, manifest);
    logMCPEvent({
      trace_id: traceId,
      method: 'find_workflow_path',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: { params: req.params, path_length: result.path.length, rationale: result.rationale },
    });
    return result;
  });

  server.onerror = (err: Error) => {
    // McpError here is a method-not-found or protocol-level fault — audit and move on.
    logMCPEvent({
      trace_id: traceId,
      method: err instanceof McpError ? `jsonrpc:${err.code}` : 'unknown',
      status: 'origin_error',
      payload: { message: err.message },
    });
  };

  return server;
};
