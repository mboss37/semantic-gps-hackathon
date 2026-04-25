import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Manifest,
  RelationshipRow,
  RouteRow,
  RouteStepRow,
  ServerRow,
  ToolRow,
} from '@/lib/manifest/cache';
import type { PreCallContext } from '@/lib/policies/enforce';

// F.2 fallback_to orchestration tests. We mock the dispatcher to control
// per-tool outcomes deterministically — mockExecuteTool's canned data isn't
// expressive enough to distinguish success vs failure per tool name.
const executeToolMock = vi.fn();

vi.mock('@/lib/mcp/tool-dispatcher', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mcp/tool-dispatcher')>(
    '@/lib/mcp/tool-dispatcher',
  );
  return {
    ...actual,
    executeTool: (...args: Parameters<typeof actual.executeTool>) =>
      executeToolMock(...args),
  };
});

const logMCPEventMock = vi.fn();
vi.mock('@/lib/audit/logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audit/logger')>(
    '@/lib/audit/logger',
  );
  return {
    ...actual,
    logMCPEvent: (event: Parameters<typeof actual.logMCPEvent>[0]) => {
      logMCPEventMock(event);
    },
  };
});

// Import AFTER the vi.mock calls so executeRoute picks up the mocked deps.
import { executeRoute, type PolicyContextBuilder } from '@/lib/mcp/execute-route';

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ORG_ID = uuid(1);
const SERVER_ID = uuid(2);
const T = {
  findAccount: uuid(10),
  findContact: uuid(11),
  findContactCached: uuid(12),
} as const;
const ROUTE_ID = uuid(30);
const STEP = {
  one: uuid(40),
  two: uuid(41),
} as const;
const REL_ID = uuid(50);

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
  { id: T.findAccount, server_id: SERVER_ID, name: 'find_account', description: null, input_schema: {} },
  { id: T.findContact, server_id: SERVER_ID, name: 'find_contact', description: null, input_schema: {} },
  {
    id: T.findContactCached,
    server_id: SERVER_ID,
    name: 'find_contact_cached',
    description: null,
    input_schema: {},
  },
];

const route: RouteRow = {
  id: ROUTE_ID,
  organization_id: ORG_ID,
  domain_id: null,
  name: 'account_contact_lookup',
  description: 'find_account → find_contact (fallback_to find_contact_cached)',
  created_at: new Date().toISOString(),
};

const routeSteps: RouteStepRow[] = [
  {
    id: STEP.one,
    route_id: ROUTE_ID,
    step_order: 1,
    tool_id: T.findAccount,
    input_mapping: { query: '$inputs.query' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: 'account',
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: STEP.two,
    route_id: ROUTE_ID,
    step_order: 2,
    tool_id: T.findContact,
    input_mapping: { accountId: '$steps.account.id' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: 'contact',
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
];

const fallbackRel: RelationshipRow = {
  id: REL_ID,
  from_tool_id: T.findContact,
  to_tool_id: T.findContactCached,
  relationship_type: 'fallback_to',
  description: 'use cache when the live contact lookup fails',
};

const manifest = (): Manifest => ({
  loadedAt: Date.now(),
  servers: [server],
  tools,
  relationships: [fallbackRel],
  policies: [],
  assignments: [],
  routes: [route],
  route_steps: routeSteps,
});

const policyCtxBuilder: PolicyContextBuilder = (entry, resolvedArgs): PreCallContext => ({
  server_id: entry.server_id,
  tool_id: entry.tool_id,
  tool_name: entry.name,
  args: resolvedArgs,
});

// Helper: route executeTool to different outcomes keyed by tool name, so each
// test can script per-tool success/failure without re-threading a manifest.
type ExecOutcome = { ok: true; result: unknown } | { ok: false; error: string };
const configureExec = (byName: Record<string, ExecOutcome>): void => {
  executeToolMock.mockImplementation(async (_manifest, entry) => {
    const outcome = byName[entry.name];
    if (!outcome) {
      return { ok: true, result: { tool: entry.name, defaulted: true } };
    }
    if (outcome.ok) return { ok: true, result: outcome.result };
    return { ok: false, result: { error: outcome.error }, error: outcome.error };
  });
};

const fallbackTriggeredEvents = (): unknown[] =>
  logMCPEventMock.mock.calls
    .map((call) => call[0])
    .filter((e): e is { status: string } =>
      typeof e === 'object' && e !== null && (e as { status?: unknown }).status === 'fallback_triggered',
    );

describe('executeRoute fallback_to', () => {
  beforeEach(() => {
    process.env.REAL_PROXY_ENABLED = '0';
    executeToolMock.mockReset();
    logMCPEventMock.mockReset();
  });

  it('does not attempt fallback when the primary step succeeds', async () => {
    configureExec({
      find_account: { ok: true, result: { id: 'acc_1', name: 'Acme Inc.' } },
      find_contact: { ok: true, result: { id: 'con_1', name: 'Jane Doe', accountId: 'acc_1' } },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'acme' } },
      manifest(),
      policyCtxBuilder,
      { traceId: 'trace-primary-ok', organizationId: null },
    );

    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1]?.status).toBe('ok');
    expect(result.steps[1]?.fallback_used).toBeUndefined();
    expect(result.steps[1]?.fallback_also_failed).toBeUndefined();
    expect(fallbackTriggeredEvents()).toHaveLength(0);
    // find_contact_cached should NEVER have been dispatched when primary ok.
    const execCallNames = executeToolMock.mock.calls.map((c) => c[1].name);
    expect(execCallNames).not.toContain('find_contact_cached');
  });

  it('uses the fallback tool when the primary errors and captures its result downstream', async () => {
    configureExec({
      find_account: { ok: true, result: { id: 'acc_1', name: 'Acme Inc.' } },
      find_contact: { ok: false, error: 'upstream 503' },
      find_contact_cached: {
        ok: true,
        result: { id: 'con_cache', name: 'Jane Doe (cached)', accountId: 'acc_1' },
      },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'acme' } },
      manifest(),
      policyCtxBuilder,
      { traceId: 'trace-fallback-ok', organizationId: null },
    );

    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(2);
    const contactStep = result.steps[1];
    expect(contactStep?.status).toBe('ok');
    expect(contactStep?.tool_name).toBe('find_contact');
    expect(contactStep?.fallback_used).toEqual({
      original_tool_name: 'find_contact',
      fallback_tool_name: 'find_contact_cached',
      fallback_tool_id: T.findContactCached,
      original_error: 'upstream 503',
    });
    expect(contactStep?.fallback_also_failed).toBeUndefined();
    const events = fallbackTriggeredEvents();
    expect(events).toHaveLength(1);
    // The executeTool mock should have been called for primary + fallback.
    const execCallNames = executeToolMock.mock.calls.map((c) => c[1].name);
    expect(execCallNames).toEqual(['find_account', 'find_contact', 'find_contact_cached']);
  });

  it('halts when both primary and fallback error, emitting two fallback_triggered events', async () => {
    configureExec({
      find_account: { ok: true, result: { id: 'acc_1' } },
      find_contact: { ok: false, error: 'primary boom' },
      find_contact_cached: { ok: false, error: 'cache cold' },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'acme' } },
      manifest(),
      policyCtxBuilder,
      { traceId: 'trace-fallback-fail', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.halted_at_step).toBe(2);
    expect(result.steps).toHaveLength(2);
    const contactStep = result.steps[1];
    expect(contactStep?.status).toBe('origin_error');
    expect(contactStep?.fallback_also_failed).toBe(true);
    expect(contactStep?.error).toMatch(/primary boom/);
    expect(contactStep?.error).toMatch(/find_contact_cached/);
    // Two events: one emitted by the per-step exec audit (origin_error primary),
    // plus our fallback_triggered event for the cache failure. We only check
    // the fallback-specific ones here.
    expect(fallbackTriggeredEvents()).toHaveLength(1);
  });

  it('does not recursively follow a chain of fallback_to edges', async () => {
    // Add a second edge: find_contact_cached → find_account. If the orchestrator
    // recursed, it would call find_account a second time after the cache error.
    // We assert it does NOT by counting executeTool invocations.
    const recurseManifest: Manifest = {
      ...manifest(),
      relationships: [
        fallbackRel,
        {
          id: uuid(51),
          from_tool_id: T.findContactCached,
          to_tool_id: T.findAccount,
          relationship_type: 'fallback_to',
          description: 'must not recurse',
        },
      ],
    };

    configureExec({
      find_account: { ok: true, result: { id: 'acc_1' } },
      find_contact: { ok: false, error: 'primary boom' },
      find_contact_cached: { ok: false, error: 'cache cold' },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { query: 'acme' } },
      recurseManifest,
      policyCtxBuilder,
      { traceId: 'trace-no-recurse', organizationId: null },
    );

    expect(result.ok).toBe(false);
    // find_account (step 1) + find_contact (step 2 primary) + find_contact_cached
    // (step 2 fallback). No extra find_account call from recursion.
    const execCallNames = executeToolMock.mock.calls.map((c) => c[1].name);
    expect(execCallNames).toEqual(['find_account', 'find_contact', 'find_contact_cached']);
  });
});
