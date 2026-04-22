import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logMCPEvent, redactPayload } from '@/lib/audit/logger';
import { loadManifest } from '@/lib/manifest/cache';
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
};

export const createStatelessServer = ({ traceId }: CreateServerOpts): Server => {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: { listChanged: true } },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const started = performance.now();
    const manifest = await loadManifest();
    const catalog = buildCatalog(manifest);
    logMCPEvent({
      trace_id: traceId,
      method: 'tools/list',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: { tool_count: catalog.length },
    });
    return {
      tools: catalog.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest();
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

    const rawResult = await executeTool(manifest, entry, args, { traceId });
    const post = runPostCallPolicies({ ...policyCtx, result: rawResult }, manifest);

    logMCPEvent({
      trace_id: traceId,
      server_id: entry.server_id,
      tool_name: entry.name,
      method: 'tools/call',
      status: 'ok',
      policy_decisions: [...pre.decisions, ...post.decisions],
      latency_ms: Math.round(performance.now() - started),
      payload: { args: redactPayload(args), result: redactPayload(post.result) },
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(post.result, null, 2) }],
    };
  });

  server.setRequestHandler(DiscoverRelationshipsRequestSchema, async (req) => {
    const started = performance.now();
    const result = await discoverRelationships(req.params);
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
    const result = await findWorkflowPath(req.params);
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
