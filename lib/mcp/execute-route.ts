import { logMCPEvent, redactPayload } from '@/lib/audit/logger';
import type { Manifest, RouteStepRow, ToolRow } from '@/lib/manifest/cache';
import { buildCatalog, executeTool, type ToolCatalogEntry } from '@/lib/mcp/tool-dispatcher';
import type {
  ExecuteRouteParams,
  ExecuteRouteResult,
  ExecuteRouteStep,
  ExecuteRouteStepStatus,
} from '@/lib/mcp/trel-schemas';
import {
  runPostCallPolicies,
  runPreCallPolicies,
  type PreCallContext,
} from '@/lib/policies/enforce';

// Multi-step orchestrator. Given a route_id + caller inputs, it sorts the
// route_steps by step_order, resolves each step's input_mapping against a
// rolling capture-bag, and threads every call through the same pre/post
// policy stack + real proxies as a plain tools/call. Halts on first error
// with halted_at_step — fallback/rollback are Sprint 7 concerns.

export type PolicyContextBuilder = (
  entry: ToolCatalogEntry,
  args: Record<string, unknown>,
) => PreCallContext;

export type ExecuteRouteCtx = {
  traceId: string;
};

// input_mapping DSL prefixes. Only values matching these prefixes at the head
// are resolved; everything else (including embedded `$inputs.foo` mid-string)
// passes through as a literal.
const STEPS_PREFIX = '$steps.';
const INPUTS_PREFIX = '$inputs.';

// Resolve a "$steps.<capture_key>.<dot.path>" reference against the capture
// bag. Supports dot segments and numeric array indices — no wildcards, no
// slices. Missing paths throw so misconfigured routes fail loud rather than
// silently feeding `undefined` into the next tool.
const resolveStepRef = (path: string, captureBag: Record<string, unknown>): unknown => {
  const segments = path.slice(STEPS_PREFIX.length).split('.');
  let cursor: unknown = captureBag;
  for (const seg of segments) {
    if (seg === '') {
      throw new Error(`empty segment in "${path}"`);
    }
    if (cursor === null || cursor === undefined) {
      throw new Error(`"${path}" traversal hit null/undefined at segment "${seg}"`);
    }
    if (Array.isArray(cursor) && /^\d+$/.test(seg)) {
      cursor = cursor[Number(seg)];
      continue;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[seg];
      continue;
    }
    throw new Error(`"${path}" traversal reached a primitive at segment "${seg}"`);
  }
  return cursor;
};

const resolveInputMapping = (
  mapping: Record<string, unknown>,
  inputs: Record<string, unknown>,
  captureBag: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(mapping)) {
    if (typeof raw !== 'string') {
      out[key] = raw;
      continue;
    }
    if (raw.startsWith(STEPS_PREFIX)) {
      out[key] = resolveStepRef(raw, captureBag);
      continue;
    }
    if (raw.startsWith(INPUTS_PREFIX)) {
      out[key] = inputs[raw.slice(INPUTS_PREFIX.length)];
      continue;
    }
    out[key] = raw;
  }
  return out;
};

const findCatalogEntry = (
  catalog: ToolCatalogEntry[],
  tool: ToolRow,
): ToolCatalogEntry | undefined =>
  catalog.find((c) => c.tool_id === tool.id && c.source === 'manifest');

const terminalError = (routeId: string, rationale: string): ExecuteRouteResult => ({
  ok: false,
  route_id: routeId,
  steps: [],
  rationale,
});

// Build an execution plan up-front so we fail-fast on missing rows rather
// than mid-route. Returns either the sorted-steps-with-tools pairs or a
// terminal error result.
const buildPlan = (
  routeId: string,
  manifest: Manifest,
): { steps: Array<{ step: RouteStepRow; tool: ToolRow }> } | { error: ExecuteRouteResult } => {
  const route = manifest.routes.find((r) => r.id === routeId);
  if (!route) {
    return { error: terminalError(routeId, `route ${routeId} not found in scope`) };
  }
  const steps = manifest.route_steps
    .filter((s) => s.route_id === routeId)
    .slice()
    .sort((a, b) => a.step_order - b.step_order);
  if (steps.length === 0) {
    return { error: terminalError(routeId, `route ${routeId} has no steps`) };
  }
  const pairs: Array<{ step: RouteStepRow; tool: ToolRow }> = [];
  for (const step of steps) {
    const tool = manifest.tools.find((t) => t.id === step.tool_id);
    if (!tool) {
      return {
        error: terminalError(
          routeId,
          `route ${routeId} step ${step.step_order} references missing tool ${step.tool_id}`,
        ),
      };
    }
    pairs.push({ step, tool });
  }
  return { steps: pairs };
};

// ---------------------------------------------------------------------------
// Per-step helpers. Each one emits its own audit log and returns the
// ExecuteRouteStep shape so `runSingleStep` can stay a thin dispatcher.

const emitInputMappingError = (
  step: RouteStepRow,
  tool: ToolRow,
  started: number,
  error: unknown,
  traceId: string,
): ExecuteRouteStep => {
  const message = error instanceof Error ? error.message : String(error);
  const latencyMs = Math.round(performance.now() - started);
  const errText = `input_mapping: ${message}`;
  logMCPEvent({
    trace_id: traceId,
    server_id: tool.server_id,
    tool_name: tool.name,
    method: 'execute_route.step',
    status: 'origin_error',
    latency_ms: latencyMs,
    payload: { step_order: step.step_order, reason: errText },
  });
  return {
    step_order: step.step_order,
    tool_name: tool.name,
    status: 'origin_error',
    latency_ms: latencyMs,
    error: errText,
  };
};

const emitBlockedStep = (
  step: RouteStepRow,
  tool: ToolRow,
  args: Record<string, unknown>,
  started: number,
  pre: ReturnType<typeof runPreCallPolicies>,
  traceId: string,
): ExecuteRouteStep => {
  const latencyMs = Math.round(performance.now() - started);
  const reason = pre.action === 'block' ? pre.reason : 'blocked_by_policy';
  logMCPEvent({
    trace_id: traceId,
    server_id: tool.server_id,
    tool_name: tool.name,
    method: 'execute_route.step',
    status: 'blocked_by_policy',
    policy_decisions: pre.decisions,
    latency_ms: latencyMs,
    payload: { step_order: step.step_order, args: redactPayload(args), reason },
  });
  return {
    step_order: step.step_order,
    tool_name: tool.name,
    status: 'blocked_by_policy',
    latency_ms: latencyMs,
    error: reason,
  };
};

const emitExecStep = (
  step: RouteStepRow,
  tool: ToolRow,
  args: Record<string, unknown>,
  exec: Awaited<ReturnType<typeof executeTool>>,
  post: ReturnType<typeof runPostCallPolicies>,
  pre: ReturnType<typeof runPreCallPolicies>,
  started: number,
  traceId: string,
): ExecuteRouteStep => {
  const latencyMs = exec.upstreamLatencyMs ?? Math.round(performance.now() - started);
  const status: ExecuteRouteStepStatus = exec.ok ? 'ok' : 'origin_error';
  logMCPEvent({
    trace_id: traceId,
    server_id: tool.server_id,
    tool_name: tool.name,
    method: 'execute_route.step',
    status,
    policy_decisions: [...pre.decisions, ...post.decisions],
    latency_ms: latencyMs,
    payload: {
      step_order: step.step_order,
      args: redactPayload(args),
      result: redactPayload(post.result),
    },
  });
  if (!exec.ok) {
    return {
      step_order: step.step_order,
      tool_name: tool.name,
      status: 'origin_error',
      latency_ms: latencyMs,
      error: exec.error,
    };
  }
  return {
    step_order: step.step_order,
    tool_name: tool.name,
    status: 'ok',
    latency_ms: latencyMs,
    result: post.result,
  };
};

const runSingleStep = async (
  pair: { step: RouteStepRow; tool: ToolRow },
  entry: ToolCatalogEntry,
  manifest: Manifest,
  inputs: Record<string, unknown>,
  captureBag: Record<string, unknown>,
  policyCtxBuilder: PolicyContextBuilder,
  ctx: ExecuteRouteCtx,
): Promise<ExecuteRouteStep> => {
  const started = performance.now();
  const { step, tool } = pair;

  let args: Record<string, unknown>;
  try {
    args = resolveInputMapping(
      (step.input_mapping ?? {}) as Record<string, unknown>,
      inputs,
      captureBag,
    );
  } catch (err) {
    return emitInputMappingError(step, tool, started, err, ctx.traceId);
  }

  const policyCtx = policyCtxBuilder(entry, args);
  const pre = runPreCallPolicies(policyCtx, manifest);
  if (pre.action === 'block') {
    return emitBlockedStep(step, tool, args, started, pre, ctx.traceId);
  }

  const execResult = await executeTool(manifest, entry, args, { traceId: ctx.traceId });
  const post = runPostCallPolicies({ ...policyCtx, result: execResult.result }, manifest);
  const stepResult = emitExecStep(step, tool, args, execResult, post, pre, started, ctx.traceId);

  if (stepResult.status === 'ok' && step.output_capture_key) {
    captureBag[step.output_capture_key] = post.result;
  }
  return stepResult;
};

// Resolve a plan pair to a catalog entry. Returns either the entry or a
// terminal step-result + rationale describing the miss.
const resolveEntry = (
  pair: { step: RouteStepRow; tool: ToolRow },
  catalog: ToolCatalogEntry[],
): { entry: ToolCatalogEntry } | { terminalStep: ExecuteRouteStep; rationale: string } => {
  const entry = findCatalogEntry(catalog, pair.tool);
  if (entry) return { entry };
  return {
    terminalStep: {
      step_order: pair.step.step_order,
      tool_name: pair.tool.name,
      status: 'origin_error',
      latency_ms: 0,
      error: `catalog entry missing for tool ${pair.tool.name}`,
    },
    rationale: `Halted at step ${pair.step.step_order}: catalog entry missing for tool ${pair.tool.name}.`,
  };
};

const haltedResult = (
  routeId: string,
  steps: ExecuteRouteStep[],
  last: ExecuteRouteStep,
): ExecuteRouteResult => ({
  ok: false,
  route_id: routeId,
  steps,
  halted_at_step: last.step_order,
  rationale: `Halted at step ${last.step_order} (${last.tool_name}): ${last.status}${
    last.error ? ` — ${last.error}` : ''
  }.`,
});

export const executeRoute = async (
  params: ExecuteRouteParams,
  manifest: Manifest,
  policyCtxBuilder: PolicyContextBuilder,
  ctx: ExecuteRouteCtx,
): Promise<ExecuteRouteResult> => {
  const plan = buildPlan(params.route_id, manifest);
  if ('error' in plan) return plan.error;

  const catalog = buildCatalog(manifest);
  const captureBag: Record<string, unknown> = {};
  const steps: ExecuteRouteStep[] = [];

  for (const pair of plan.steps) {
    const resolved = resolveEntry(pair, catalog);
    if ('terminalStep' in resolved) {
      steps.push(resolved.terminalStep);
      return { ...haltedResult(params.route_id, steps, resolved.terminalStep), rationale: resolved.rationale };
    }

    const stepResult = await runSingleStep(
      pair,
      resolved.entry,
      manifest,
      params.inputs,
      captureBag,
      policyCtxBuilder,
      ctx,
    );
    steps.push(stepResult);
    if (stepResult.status !== 'ok') {
      return haltedResult(params.route_id, steps, stepResult);
    }
  }

  return {
    ok: true,
    route_id: params.route_id,
    steps,
    rationale: `Completed ${steps.length} step(s) in order.`,
  };
};
