import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Manifest,
  PolicyRow,
  RouteRow,
  RouteStepRow,
  ServerRow,
  ToolRow,
} from '@/lib/manifest/cache';
import { executeRoute, type PolicyContextBuilder } from '@/lib/mcp/execute-route';
import type { PreCallContext } from '@/lib/policies/enforce';

// Silence the fire-and-forget Supabase insert in `logMCPEvent`. Local dev
// otherwise lets the real client fire against Docker Supabase, which race-flakes
// vitest workers at teardown when multiple files log concurrently (the
// `.then(console.error)` chain resolves after the worker closes rpc). Sibling
// execute-route-{fallback,rollback}.vitest.ts use the same pattern.
vi.mock('@/lib/audit/logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audit/logger')>(
    '@/lib/audit/logger',
  );
  return {
    ...actual,
    logMCPEvent: () => {},
  };
});

// Unit tests for F.1 executeRoute. Hand-rolled Manifest fixtures keep this
// deterministic, real proxies are disabled so mockExecuteTool canned data
// runs. Covers: ordered execution, output capture + $steps.* resolution,
// halt-on-error with halted_at_step, and policy block path.

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ORG_ID = uuid(1);
const SERVER_ID = uuid(2);
const T = {
  searchCustomer: uuid(10),
  getCustomer: uuid(11),
  createTicket: uuid(12),
} as const;
const ROUTE_ID = uuid(30);
const STEP = {
  one: uuid(40),
  two: uuid(41),
  three: uuid(42),
} as const;

const server: ServerRow = {
  id: SERVER_ID,
  organization_id: ORG_ID,
  domain_id: null,
  name: 'salesops',
  origin_url: null,
  transport: 'openapi',
  openapi_spec: null,
  auth_config: null,
  created_at: new Date().toISOString(),
};

const tools: ToolRow[] = [
  {
    id: T.searchCustomer,
    server_id: SERVER_ID,
    name: 'searchCustomer',
    description: null,
    input_schema: {},
  },
  {
    id: T.getCustomer,
    server_id: SERVER_ID,
    name: 'getCustomer',
    description: null,
    input_schema: {},
  },
  {
    id: T.createTicket,
    server_id: SERVER_ID,
    name: 'createTicket',
    description: null,
    input_schema: {},
  },
];

const route: RouteRow = {
  id: ROUTE_ID,
  organization_id: ORG_ID,
  domain_id: null,
  name: 'customer_escalation',
  description: 'search → fetch → ticket',
  created_at: new Date().toISOString(),
};

const routeSteps: RouteStepRow[] = [
  {
    id: STEP.one,
    route_id: ROUTE_ID,
    step_order: 1,
    tool_id: T.searchCustomer,
    input_mapping: { name: '$inputs.query' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: 'search',
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: STEP.two,
    route_id: ROUTE_ID,
    step_order: 2,
    tool_id: T.getCustomer,
    // Pull the first customer id from the searchCustomer mock result -
    // mockExecuteTool returns `.customers[0].id`.
    input_mapping: { customerId: '$steps.search.customers.0.id' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: 'customer',
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: STEP.three,
    route_id: ROUTE_ID,
    step_order: 3,
    tool_id: T.createTicket,
    input_mapping: {
      customerId: '$steps.customer.id',
      subject: 'Escalation for $inputs.query',
    },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: null,
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
];

const baseManifest = (policies: PolicyRow[] = [], assignments: Manifest['assignments'] = []): Manifest => ({
  loadedAt: Date.now(),
  servers: [server],
  tools,
  relationships: [],
  policies,
  assignments,
  routes: [route],
  route_steps: routeSteps,
});

const policyCtxBuilder: PolicyContextBuilder = (entry, resolvedArgs): PreCallContext => ({
  server_id: entry.server_id,
  tool_id: entry.tool_id,
  tool_name: entry.name,
  args: resolvedArgs,
});

describe('executeRoute', () => {
  beforeEach(() => {
    process.env.REAL_PROXY_ENABLED = '0';
  });

  it('executes steps in order and threads captured outputs into later steps', async () => {
    const manifest = baseManifest();
    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'jane' } },
      manifest,
      policyCtxBuilder,
      { traceId: 'trace-ok', organizationId: null },
    );

    expect(result.ok).toBe(true);
    expect(result.steps.map((s) => s.step_order)).toEqual([1, 2, 3]);
    expect(result.steps.map((s) => s.status)).toEqual(['ok', 'ok', 'ok']);

    // Step 2 should have received the first searchCustomer customer's id.
    // The literal "Escalation for $inputs.query" is passed through because
    // it doesn't start with a $-prefix, only "$steps." / "$inputs." at the
    // head are resolved.
    const ticketStep = result.steps.find((s) => s.step_order === 3);
    const ticketResult = ticketStep?.result as { customerId: string; opened_by: string };
    expect(ticketResult.customerId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('halts on origin_error with halted_at_step set to the failing step', async () => {
    // Inject a bad reference: step 2 now asks for a path that doesn't exist
    // in the capture bag. resolveInputMapping throws, and the step is
    // surfaced as origin_error with input_mapping prefix.
    const manifest = baseManifest();
    // Clone the fixture steps, override only step 2's input_mapping to a bad
    // path, `.map` keeps the array dense so no non-null assertions needed.
    manifest.route_steps = routeSteps.map((s) =>
      s.step_order === 2
        ? { ...s, input_mapping: { customerId: '$steps.search.nonexistent.path' } }
        : s,
    );

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'jane' } },
      manifest,
      policyCtxBuilder,
      { traceId: 'trace-halt', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.halted_at_step).toBe(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1]?.status).toBe('origin_error');
    expect(result.steps[1]?.error).toMatch(/input_mapping/);
    expect(result.rationale).toMatch(/halted at step 2/i);
  });

  it('blocks and halts when a pre-call policy rejects an intermediate step', async () => {
    // Allowlist that permits searchCustomer + createTicket but NOT
    // getCustomer. Enforce mode → step 2 blocks → route halts with
    // halted_at_step=2 and status blocked_by_policy.
    const policy: PolicyRow = {
      id: uuid(70),
      name: 'block getCustomer',
      builtin_key: 'allowlist',
      config: { tool_names: ['searchCustomer', 'createTicket'] },
      enforcement_mode: 'enforce',
    };
    const manifest = baseManifest(
      [policy],
      [{ id: uuid(71), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
    );

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'jane' } },
      manifest,
      policyCtxBuilder,
      { traceId: 'trace-block', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.halted_at_step).toBe(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.status).toBe('ok');
    expect(result.steps[1]?.status).toBe('blocked_by_policy');
    expect(result.steps[1]?.error).toMatch(/allowlist/i);
  });

  it('returns a terminal error when the route_id is not in the manifest scope', async () => {
    const manifest = baseManifest();
    const result = await executeRoute(
      { route_id: uuid(99), inputs: {} },
      manifest,
      policyCtxBuilder,
      { traceId: 'trace-missing', organizationId: null },
    );
    expect(result.ok).toBe(false);
    expect(result.steps).toHaveLength(0);
    expect(result.rationale).toMatch(/not found in scope/);
  });
});
