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

// F.3 rollback orchestration tests. Mocks the tool dispatcher + audit logger
// to script per-tool outcomes and capture rollback_executed events without
// hitting real upstreams or Supabase.
const executeToolMock = vi.fn();

vi.mock('@/lib/mcp/tool-dispatcher', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mcp/tool-dispatcher')>(
    '@/lib/mcp/tool-dispatcher',
  );
  return {
    ...actual,
    executeTool: (...args: Parameters<typeof actual.executeTool>) => executeToolMock(...args),
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
  createAccount: uuid(10),
  createContact: uuid(11),
  createTask: uuid(12),
  deleteAccount: uuid(20),
  deleteContact: uuid(21),
  deleteTask: uuid(22),
} as const;
const ROUTE_ID = uuid(30);

const server: ServerRow = {
  id: SERVER_ID,
  organization_id: ORG_ID,
  domain_id: null,
  name: 'salesforce',
  origin_url: null,
  transport: 'openapi',
  openapi_spec: null,
  auth_config: null,
  created_at: new Date().toISOString(),
};

const allTools: ToolRow[] = [
  { id: T.createAccount, server_id: SERVER_ID, name: 'sf.create_account', description: null, input_schema: {} },
  { id: T.createContact, server_id: SERVER_ID, name: 'sf.create_contact', description: null, input_schema: {} },
  { id: T.createTask, server_id: SERVER_ID, name: 'sf.create_task', description: null, input_schema: {} },
  { id: T.deleteAccount, server_id: SERVER_ID, name: 'sf.delete_account', description: null, input_schema: {} },
  { id: T.deleteContact, server_id: SERVER_ID, name: 'sf.delete_contact', description: null, input_schema: {} },
  { id: T.deleteTask, server_id: SERVER_ID, name: 'sf.delete_task', description: null, input_schema: {} },
];

const route: RouteRow = {
  id: ROUTE_ID,
  organization_id: ORG_ID,
  domain_id: null,
  name: 'create_account_with_contact_and_task',
  description: 'create_account → create_contact → create_task (each with a compensated_by delete)',
  created_at: new Date().toISOString(),
};

const threeStepRoute: RouteStepRow[] = [
  {
    id: uuid(40),
    route_id: ROUTE_ID,
    step_order: 1,
    tool_id: T.createAccount,
    input_mapping: { name: '$inputs.name' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: 'account',
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: uuid(41),
    route_id: ROUTE_ID,
    step_order: 2,
    tool_id: T.createContact,
    input_mapping: { accountId: '$steps.account.id' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: 'contact',
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: uuid(42),
    route_id: ROUTE_ID,
    step_order: 3,
    tool_id: T.createTask,
    input_mapping: { accountId: '$steps.account.id' },
    rollback_input_mapping: null,
    fallback_input_mapping: null,
    fallback_rollback_input_mapping: null,
    output_capture_key: null,
    fallback_route_id: null,
    rollback_tool_id: null,
    created_at: new Date().toISOString(),
  },
];

const twoStepRoute: RouteStepRow[] = [threeStepRoute[0]!, threeStepRoute[1]!];

const compensationRels: RelationshipRow[] = [
  {
    id: uuid(50),
    from_tool_id: T.createAccount,
    to_tool_id: T.deleteAccount,
    relationship_type: 'compensated_by',
    description: 'undo create_account',
  },
  {
    id: uuid(51),
    from_tool_id: T.createContact,
    to_tool_id: T.deleteContact,
    relationship_type: 'compensated_by',
    description: 'undo create_contact',
  },
  {
    id: uuid(52),
    from_tool_id: T.createTask,
    to_tool_id: T.deleteTask,
    relationship_type: 'compensated_by',
    description: 'undo create_task',
  },
];

type ManifestOverrides = {
  route_steps?: RouteStepRow[];
  relationships?: RelationshipRow[];
};

const buildManifest = (overrides: ManifestOverrides = {}): Manifest => ({
  loadedAt: Date.now(),
  servers: [server],
  tools: allTools,
  relationships: overrides.relationships ?? compensationRels,
  policies: [],
  assignments: [],
  routes: [route],
  route_steps: overrides.route_steps ?? threeStepRoute,
});

const policyCtxBuilder: PolicyContextBuilder = (entry, resolvedArgs): PreCallContext => ({
  server_id: entry.server_id,
  tool_id: entry.tool_id,
  tool_name: entry.name,
  args: resolvedArgs,
});

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

const rollbackEvents = (): Array<{ payload: { compensation_tool: string; original_step_order: number } }> =>
  logMCPEventMock.mock.calls
    .map((call) => call[0] as { status: string; payload: { compensation_tool: string; original_step_order: number } })
    .filter((e) => e.status === 'rollback_executed');

const execCallNames = (): string[] =>
  executeToolMock.mock.calls.map((c) => (c[1] as { name: string }).name);

describe('executeRoute rollback', () => {
  beforeEach(() => {
    process.env.REAL_PROXY_ENABLED = '0';
    executeToolMock.mockReset();
    logMCPEventMock.mockReset();
  });

  it('does not attempt rollback when every step succeeds', async () => {
    configureExec({
      'sf.create_account': { ok: true, result: { id: 'acc_1', name: 'Acme' } },
      'sf.create_contact': { ok: true, result: { id: 'con_1', accountId: 'acc_1' } },
      'sf.create_task': { ok: true, result: { id: 'tsk_1', success: true } },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'Acme' } },
      buildManifest(),
      policyCtxBuilder,
      { traceId: 'trace-happy', organizationId: null },
    );

    expect(result.ok).toBe(true);
    expect(result.rollback_summary).toBeUndefined();
    expect(result.steps.every((s) => s.rollback === undefined)).toBe(true);
    expect(rollbackEvents()).toHaveLength(0);
    // No delete_* calls whatsoever.
    expect(execCallNames().filter((n) => n.startsWith('sf.delete_'))).toHaveLength(0);
  });

  it('runs compensations in reverse order when a mid-route step errors', async () => {
    configureExec({
      'sf.create_account': { ok: true, result: { id: 'acc_1', name: 'Acme' } },
      'sf.create_contact': { ok: true, result: { id: 'con_1', accountId: 'acc_1' } },
      'sf.create_task': { ok: false, error: 'origin 500' },
      'sf.delete_account': { ok: true, result: { success: true } },
      'sf.delete_contact': { ok: true, result: { success: true } },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'Acme' } },
      buildManifest(),
      policyCtxBuilder,
      { traceId: 'trace-rollback', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.halted_at_step).toBe(3);

    // Compensation order: delete_contact (step 2) BEFORE delete_account (step 1).
    const deleteCalls = execCallNames().filter((n) => n.startsWith('sf.delete_'));
    expect(deleteCalls).toEqual(['sf.delete_contact', 'sf.delete_account']);

    // Step 1 + 2 rolled back ok; step 3 (the failure) has no rollback attempt.
    expect(result.steps[0]?.rollback).toEqual({
      attempted: true,
      status: 'ok',
      compensation_tool_name: 'sf.delete_account',
    });
    expect(result.steps[1]?.rollback).toEqual({
      attempted: true,
      status: 'ok',
      compensation_tool_name: 'sf.delete_contact',
    });
    expect(result.steps[2]?.rollback).toBeUndefined();

    expect(result.rollback_summary).toEqual({
      attempted: true,
      compensated_count: 2,
      skipped_count: 0,
      failed_count: 0,
    });

    // Two rollback_executed events, both sharing the route traceId.
    const evts = rollbackEvents();
    expect(evts).toHaveLength(2);
    const compensationToolNames = evts.map((e) => e.payload.compensation_tool);
    expect(compensationToolNames).toEqual(['sf.delete_contact', 'sf.delete_account']);

    // Compensations are called with the original result, verify the args
    // the dispatcher saw for delete_contact include accountId from step 2's
    // result, not step 3's args.
    const deleteContactCall = executeToolMock.mock.calls.find(
      (c) => (c[1] as { name: string }).name === 'sf.delete_contact',
    );
    const deleteContactArgs = deleteContactCall?.[2] as Record<string, unknown>;
    expect(deleteContactArgs.id).toBe('con_1');
    expect(deleteContactArgs.accountId).toBe('acc_1');
  });

  // Sprint 19 WP-19.9 regression: in-process HTTP-Streamable MCPs
  // (SF/Slack/GitHub under app/api/mcps/<vendor>/) wrap results in the MCP
  // wire envelope {content:[{type:"text", text:"<JSON>"}]}. Pre-fix the
  // capture bag stored the envelope verbatim, so every downstream step
  // with `$steps.<key>.result.<field>` resolved to undefined and the
  // rollback cascade demo broke. Fix unwraps the envelope at capture time.
  it('unwraps MCP envelope results so downstream input_mapping and rollback see the logical object', async () => {
    // proxy-http.ts::extractResult strips the outer {content:...} wrapper
    // before handing the result to execute-route, so what reaches the
    // capture bag is a bare array of content parts. Match that shape.
    const envelopeResult = [{ type: 'text', text: '{"id":"acc_env","name":"EnvAcme"}' }];

    configureExec({
      'sf.create_account': { ok: true, result: envelopeResult },
      'sf.create_contact': { ok: true, result: { id: 'con_env', accountId: 'acc_env' } },
      'sf.create_task': { ok: false, error: 'origin 500' },
      'sf.delete_account': { ok: true, result: { success: true } },
      'sf.delete_contact': { ok: true, result: { success: true } },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'EnvAcme' } },
      buildManifest(),
      policyCtxBuilder,
      { traceId: 'trace-envelope', organizationId: null },
    );

    expect(result.ok).toBe(false);

    // Forward input_mapping, step 2 reads $steps.account.id. Without the
    // unwrap this would have been undefined and step 2 would have failed
    // or been called with accountId: undefined.
    const createContactCall = executeToolMock.mock.calls.find(
      (c) => (c[1] as { name: string }).name === 'sf.create_contact',
    );
    expect((createContactCall?.[2] as { accountId: unknown }).accountId).toBe('acc_env');

    // Rollback via compensated_by, delete_contact gets its own result's
    // accountId (con_env → acc_env), proving the envelope unwrap also
    // covers intermediate captures used by the rollback walk.
    const deleteContactCall = executeToolMock.mock.calls.find(
      (c) => (c[1] as { name: string }).name === 'sf.delete_contact',
    );
    expect((deleteContactCall?.[2] as { accountId: unknown }).accountId).toBe('acc_env');

    expect(result.rollback_summary).toEqual({
      attempted: true,
      compensated_count: 2,
      skipped_count: 0,
      failed_count: 0,
    });
  });

  it('marks a completed step without a compensated_by edge as skipped', async () => {
    // Remove create_account → delete_account edge. Step 1 completes but has
    // no compensation. Step 2 fails, triggering rollback. Since step 2 never
    // completed, only step 1 is considered for rollback, which has no edge.
    const relsWithoutAccountComp = compensationRels.filter((r) => r.from_tool_id !== T.createAccount);
    const manifest = buildManifest({
      route_steps: twoStepRoute,
      relationships: relsWithoutAccountComp,
    });

    configureExec({
      'sf.create_account': { ok: true, result: { id: 'acc_1' } },
      'sf.create_contact': { ok: false, error: 'contact upstream down' },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'Acme' } },
      manifest,
      policyCtxBuilder,
      { traceId: 'trace-partial', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.halted_at_step).toBe(2);
    expect(result.rollback_summary).toEqual({
      attempted: true,
      compensated_count: 0,
      skipped_count: 1,
      failed_count: 0,
    });
    expect(result.steps[0]?.rollback).toEqual({
      attempted: false,
      status: 'no_compensation_available',
    });
    // Failing step has no rollback annotation at all.
    expect(result.steps[1]?.rollback).toBeUndefined();
    // No delete_* calls, nothing to dispatch.
    expect(execCallNames().filter((n) => n.startsWith('sf.delete_'))).toHaveLength(0);
  });

  it('marks the step as compensation_failed when the compensation tool itself errors and continues', async () => {
    configureExec({
      'sf.create_account': { ok: true, result: { id: 'acc_1' } },
      'sf.create_contact': { ok: false, error: 'contact boom' },
      'sf.delete_account': { ok: false, error: 'delete rate-limited' },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'Acme' } },
      buildManifest({ route_steps: twoStepRoute }),
      policyCtxBuilder,
      { traceId: 'trace-comp-fail', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.steps[0]?.rollback?.status).toBe('compensation_failed');
    expect(result.steps[0]?.rollback?.error).toMatch(/delete rate-limited/);
    expect(result.rollback_summary).toEqual({
      attempted: true,
      compensated_count: 0,
      skipped_count: 0,
      failed_count: 1,
    });
    const evts = rollbackEvents();
    expect(evts).toHaveLength(1);
  });

  it('triggers rollback when a step is blocked_by_policy', async () => {
    // Use an allowlist policy that permits create_account (step 1) and the
    // compensation tools, but NOT create_contact (step 2). Rollback must run
    // even though the halt cause is governance, not a 5xx.
    const policy = {
      id: uuid(70),
      name: 'block create_contact',
      builtin_key: 'allowlist' as const,
      config: { tool_names: ['sf.create_account', 'sf.delete_account', 'sf.delete_contact'] },
      enforcement_mode: 'enforce' as const,
    };
    const manifest: Manifest = {
      ...buildManifest({ route_steps: twoStepRoute }),
      policies: [policy],
      assignments: [
        { id: uuid(71), policy_id: policy.id, server_id: SERVER_ID, tool_id: null },
      ],
    };

    configureExec({
      'sf.create_account': { ok: true, result: { id: 'acc_1' } },
      'sf.delete_account': { ok: true, result: { success: true } },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'Acme' } },
      manifest,
      policyCtxBuilder,
      { traceId: 'trace-block-rollback', organizationId: null },
    );

    expect(result.ok).toBe(false);
    expect(result.halted_at_step).toBe(2);
    expect(result.steps[1]?.status).toBe('blocked_by_policy');
    expect(result.rollback_summary?.compensated_count).toBe(1);
    expect(result.steps[0]?.rollback?.status).toBe('ok');
    expect(execCallNames()).toContain('sf.delete_account');
  });

  it('respects autoRollbackOnHalt=false and skips rollback entirely', async () => {
    configureExec({
      'sf.create_account': { ok: true, result: { id: 'acc_1' } },
      'sf.create_contact': { ok: true, result: { id: 'con_1' } },
      'sf.create_task': { ok: false, error: 'origin 500' },
    });

    const result = await executeRoute(
      { route_id: ROUTE_ID, inputs: { name: 'Acme' } },
      buildManifest(),
      policyCtxBuilder,
      { traceId: 'trace-no-rollback', organizationId: null },
      { autoRollbackOnHalt: false },
    );

    expect(result.ok).toBe(false);
    expect(result.rollback_summary).toBeUndefined();
    expect(result.steps.every((s) => s.rollback === undefined)).toBe(true);
    expect(execCallNames().filter((n) => n.startsWith('sf.delete_'))).toHaveLength(0);
    expect(rollbackEvents()).toHaveLength(0);
  });
});
