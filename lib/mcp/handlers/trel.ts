import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { logMCPEvent } from '@/lib/audit/logger';
import { loadManifest, type ManifestScope } from '@/lib/manifest/cache';
import { evaluateGoal } from '@/lib/mcp/evaluate-goal';
import { executeRoute, type PolicyContextBuilder } from '@/lib/mcp/execute-route';
import { discoverRelationships, findWorkflowPath } from '@/lib/mcp/trel-handlers';
import {
  DiscoverRelationshipsRequestSchema,
  EvaluateGoalRequestSchema,
  ExecuteRouteRequestSchema,
  FindWorkflowPathRequestSchema,
  ValidateWorkflowRequestSchema,
} from '@/lib/mcp/trel-schemas';
import { validateWorkflow } from '@/lib/mcp/validate-workflow';

// Governed-only handler block. Extracted from `stateless-server.ts` so the
// outer wiring shell stays under the file-size cap. These four TRel
// extension methods (discover_relationships / find_workflow_path /
// validate_workflow / evaluate_goal) plus the native `execute_route`
// JSON-RPC method are gateway-only surface area — raw MCP surfaces leave
// them unregistered, the SDK responds JSON-RPC -32601 (method_not_found)
// automatically.
//
// Each handler keeps its existing shape: load manifest at request time,
// run the underlying function, write an audit row, return the result.
// No behavior change vs the inlined version.

export type RegisterGovernedHandlersOpts = {
  traceId: string;
  scope: ManifestScope;
  headers?: Record<string, string>;
  clientIp?: string;
};

export const registerGovernedHandlers = (
  server: Server,
  opts: RegisterGovernedHandlersOpts,
): void => {
  const { traceId, scope, headers, clientIp } = opts;

  server.setRequestHandler(DiscoverRelationshipsRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const result = await discoverRelationships(req.params, manifest);
    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
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
      organization_id: scope.organization_id,
      method: 'find_workflow_path',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: { params: req.params, path_length: result.path.length, rationale: result.rationale },
    });
    return result;
  });

  server.setRequestHandler(ValidateWorkflowRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const result = await validateWorkflow(req.params, manifest);
    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
      method: 'validate_workflow',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: {
        params: req.params,
        valid: result.valid,
        issue_count: result.issues.length,
        graph_coverage: result.graph_coverage,
      },
    });
    return result;
  });

  server.setRequestHandler(EvaluateGoalRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    const result = await evaluateGoal(req.params, manifest);
    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
      method: 'evaluate_goal',
      status: 'ok',
      latency_ms: Math.round(performance.now() - started),
      payload: {
        goal: req.params.goal,
        candidate_count: result.candidates.length,
      },
    });
    return result;
  });

  server.setRequestHandler(ExecuteRouteRequestSchema, async (req) => {
    const started = performance.now();
    const manifest = await loadManifest(scope);
    // Per-step policy context thread the gateway-level headers + client IP so
    // request-metadata policies (basic_auth, client_id, ip_allowlist, future
    // rate_limit) see the same caller identity whether the call arrives via
    // tools/call or via execute_route.
    const policyCtxBuilder: PolicyContextBuilder = (entry, resolvedArgs) => ({
      server_id: entry.server_id,
      tool_id: entry.tool_id,
      tool_name: entry.name,
      args: resolvedArgs,
      headers,
      client_ip: clientIp,
    });
    const result = await executeRoute(req.params, manifest, policyCtxBuilder, {
      traceId,
      organizationId: scope.organization_id,
    });
    logMCPEvent({
      trace_id: traceId,
      organization_id: scope.organization_id,
      method: 'execute_route',
      status: result.ok ? 'ok' : 'origin_error',
      latency_ms: Math.round(performance.now() - started),
      payload: {
        route_id: req.params.route_id,
        step_count: result.steps.length,
        halted_at_step: result.halted_at_step,
        rationale: result.rationale,
      },
    });
    // MCP transport expects a content array for non-builtin responses. Wrap
    // the structured result as a JSON text block so clients can parse it
    // consistently with tools/call returns.
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  });
};
