import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logMCPEvent, redactPayload } from '@/lib/audit/logger';
import { loadManifest, type ManifestScope } from '@/lib/manifest/cache';
import { executeRoute, type PolicyContextBuilder } from '@/lib/mcp/execute-route';
import {
  EXECUTE_ROUTE_TOOL_NAME,
  resolveExecuteRouteParams,
} from '@/lib/mcp/execute-route-tool';
import { buildToolsListResponse } from '@/lib/mcp/handlers/list-tools';
import { registerGovernedHandlers } from '@/lib/mcp/handlers/trel';
import { buildCatalog, executeTool } from '@/lib/mcp/tool-dispatcher';
import { runPostCallPolicies, runPreCallPolicies } from '@/lib/policies/enforce';

// Low-level Server so tools/list + tools/call can merge the builtin echo with
// whatever the manifest contains at request time. Still stateless: every call
// rebuilds, connects, handles, disposes.
//
// The bulk of `tools/list` lives in `handlers/list-tools.ts` (pure builder)
// and the four TRel extension methods + native `execute_route` JSON-RPC
// handler live in `handlers/trel.ts`. This file is the wiring shell: it
// creates the SDK Server, registers the two MCP standard handlers
// (`tools/list` + `tools/call`), conditionally registers the governed
// handler block, and sets the error sink.

const SERVER_INFO = {
  name: 'semantic-gps-gateway',
  version: '0.1.0',
} as const;

type CreateServerOpts = {
  // Sprint 29: trace_id is now caller-supplied (`?trace_id=<uuid>` on the
  // gateway URL) for batched orchestrators that want every internal MCP
  // call to share one id; the gateway-handler falls back to a fresh per-
  // request UUID for ad-hoc callers. By the time we get here, it's already
  // resolved, this server just threads it onto every audit row.
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
  // When `false`, the server behaves like a plain MCP gateway: no relationship
  // sidecar on tools/list, no policy enforcement on tools/call, no semantic
  // rewriting, no TRel extension methods, no execute_route orchestration. Used
  // by /api/mcp/raw for the Playground A/B contrast, proves the value of the
  // control plane by running the same agent against a governance-stripped peer.
  // Defaults to `true` so existing callers keep the full control plane.
  governed?: boolean;
};

export const createStatelessServer = ({
  traceId,
  scope,
  headers,
  clientIp,
  governed = true,
}: CreateServerOpts): Server => {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: { listChanged: true } },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const response = buildToolsListResponse({ manifest, scope, governed });
    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
      method: 'tools/list',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: { tool_count: response.tools.length, governed },
    });
    return response;
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const catalog = buildCatalog(manifest);
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;

    // Sprint 31 WP-31.1: short-circuit `execute_route` to the saga runner
    // before catalog lookup. The synthetic tool is governed-only by design
    // (raw surfaces never expose orchestration). On the ungoverned path the
    // tool is not in the catalog, so the existing tool-not-found branch
    // returns a clean error.
    if (governed && name === EXECUTE_ROUTE_TOOL_NAME) {
      const resolved = resolveExecuteRouteParams(args, manifest.routes);
      if (!resolved.ok) {
        logMCPEvent({
          trace_id: traceId,
          organization_id: scope.organization_id,
          tool_name: name,
          method: 'tools/call',
          status: 'origin_error',
          latency_ms: Math.round(performance.now() - started),
          payload: { reason: resolved.error, governed },
        });
        return {
          isError: true,
          content: [{ type: 'text', text: resolved.error }],
        };
      }
      const policyCtxBuilder: PolicyContextBuilder = (entry, resolvedArgs) => ({
        server_id: entry.server_id,
        tool_id: entry.tool_id,
        tool_name: entry.name,
        args: resolvedArgs,
        headers,
        client_ip: clientIp,
      });
      const result = await executeRoute(
        { route_id: resolved.route_id, inputs: resolved.inputs },
        manifest,
        policyCtxBuilder,
        { traceId, organizationId: scope.organization_id },
      );
      logMCPEvent({
        trace_id: traceId,
        organization_id: scope.organization_id,
        tool_name: name,
        method: 'tools/call',
        status: result.ok ? 'ok' : 'origin_error',
        latency_ms: Math.round(performance.now() - started),
        payload: {
          route_id: resolved.route_id,
          step_count: result.steps.length,
          halted_at_step: result.halted_at_step,
          rationale: result.rationale,
          governed,
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }

    // WP-G.6: `tools/list` surfaces `display_name` when set, so `tools/call`
    // must accept EITHER origin name or display_name. Origin name still wins
    // if both exist (protects against display collisions). Builtin tools
    // have no manifest row, so they only match by origin name. Ungoverned
    // surfaces never emit display_name on tools/list, but still resolve it on
    // tools/call defensively, keeps the dispatch contract stable.
    const displayToOrigin = new Map<string, string>();
    for (const t of manifest.tools) {
      if (t.display_name) displayToOrigin.set(t.display_name, t.name);
    }
    const originName = displayToOrigin.get(name) ?? name;
    const entry = catalog.find((t) => t.name === originName);
    if (!entry) {
      logMCPEvent({
        trace_id: traceId,
        organization_id: scope.organization_id,
        tool_name: name,
        method: 'tools/call',
        status: 'origin_error',
        latency_ms: Math.round(performance.now() - started),
        payload: { reason: 'tool_not_found', governed },
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
        organization_id: scope.organization_id,
        tool_name: 'echo',
        method: 'tools/call',
        status: 'ok',
        latency_ms: Math.round(performance.now() - started),
        payload: { args: { message }, result, governed },
      });
      return result;
    }

    // Ungoverned path: dispatch straight through. No pre-call policies, no
    // post-call redaction, no PII scrubbing. Audit still fires so the demo
    // has a receipt, but `policy_decisions` is always empty, that's the
    // observable contrast on the mcp_events timeline.
    if (!governed) {
      const execResult = await executeTool(manifest, entry, args, { traceId });
      const latencyMs = execResult.upstreamLatencyMs ?? Math.round(performance.now() - started);

      logMCPEvent({
        trace_id: traceId,
        organization_id: scope.organization_id,
        server_id: entry.server_id,
        tool_name: entry.name,
        method: 'tools/call',
        status: execResult.ok ? 'ok' : 'origin_error',
        policy_decisions: [],
        latency_ms: latencyMs,
        payload: { args: redactPayload(args), result: redactPayload(execResult.result), governed: false },
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(execResult.result, null, 2) }],
      };
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
        organization_id: scope.organization_id,
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

    // Prefer the upstream latency from the real proxy when available, gives
    // the audit row a pure "time on the wire" measurement instead of the full
    // gateway round-trip (policies + serialization). Falls back to total
    // gateway latency for mock/builtin paths.
    const latencyMs = execResult.upstreamLatencyMs ?? Math.round(performance.now() - started);

    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
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

  // TRel extensions + execute_route are gateway-only surface area. Raw MCPs
  // don't expose graph discovery, workflow planning, or rollback orchestration
  //, leaving the handlers unregistered means the SDK returns JSON-RPC
  // -32601 (method_not_found) automatically. No silent success, no crash.
  if (!governed) {
    server.onerror = (err: Error) => {
      logMCPEvent({
        trace_id: traceId,
        organization_id: scope.organization_id,
        method: err instanceof McpError ? `jsonrpc:${err.code}` : 'unknown',
        status: 'origin_error',
        payload: { message: err.message, governed: false },
      });
    };
    return server;
  }

  registerGovernedHandlers(server, { traceId, scope, headers, clientIp });

  server.onerror = (err: Error) => {
    // McpError here is a method-not-found or protocol-level fault, audit and move on.
    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
      method: err instanceof McpError ? `jsonrpc:${err.code}` : 'unknown',
      status: 'origin_error',
      payload: { message: err.message },
    });
  };

  return server;
};
