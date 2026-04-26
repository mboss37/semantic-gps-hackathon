import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@/lib/manifest/cache';
import { evaluateGoal } from '@/lib/mcp/evaluate-goal';
import { validateWorkflow } from '@/lib/mcp/validate-workflow';

// Unit tests for WP-G.1 validate_workflow + evaluate_goal. Pure-function
// entry points against a hand-rolled Manifest, no DB, no gateway. The Opus
// tier is exercised via a module-level mock of '@anthropic-ai/sdk'; the
// keyword tier runs whenever ANTHROPIC_API_KEY is unset.

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const SERVER_A = uuid(1);
const T = {
  search: uuid(10),
  getCustomer: uuid(11),
  listOrders: uuid(12),
  createTicket: uuid(13),
  sendEmail: uuid(14),
} as const;
const ROUTE = {
  escalation: uuid(30),
  notify: uuid(31),
} as const;

const baseManifest = (): Manifest => ({
  loadedAt: Date.now(),
  servers: [],
  tools: [
    { id: T.search, server_id: SERVER_A, name: 'searchCustomers', description: 'Find customers by name or email.', input_schema: {} },
    { id: T.getCustomer, server_id: SERVER_A, name: 'getCustomer', description: 'Fetch a single customer.', input_schema: {} },
    { id: T.listOrders, server_id: SERVER_A, name: 'listCustomerOrders', description: 'List orders for a customer.', input_schema: {} },
    { id: T.createTicket, server_id: SERVER_A, name: 'createSupportTicket', description: 'Open a support ticket.', input_schema: {} },
    { id: T.sendEmail, server_id: SERVER_A, name: 'sendEmail', description: 'Send transactional email.', input_schema: {} },
  ],
  relationships: [
    { id: uuid(20), from_tool_id: T.search, to_tool_id: T.getCustomer, relationship_type: 'produces_input_for', description: 'search feeds getCustomer' },
    { id: uuid(21), from_tool_id: T.getCustomer, to_tool_id: T.listOrders, relationship_type: 'produces_input_for', description: 'customer feeds order list' },
    { id: uuid(22), from_tool_id: T.listOrders, to_tool_id: T.createTicket, relationship_type: 'suggests_after', description: 'ticket after order review' },
    { id: uuid(23), from_tool_id: T.getCustomer, to_tool_id: T.createTicket, relationship_type: 'requires_before', description: 'ticket requires customer context' },
    { id: uuid(24), from_tool_id: T.createTicket, to_tool_id: T.sendEmail, relationship_type: 'mutually_exclusive', description: 'ticket XOR email; pick one channel' },
  ],
  policies: [],
  assignments: [],
  routes: [
    {
      id: ROUTE.escalation,
      organization_id: uuid(99),
      domain_id: null,
      name: 'customer_escalation',
      description: 'Look up a customer and open a support ticket.',
      created_at: new Date().toISOString(),
    },
    {
      id: ROUTE.notify,
      organization_id: uuid(99),
      domain_id: null,
      name: 'order_notification',
      description: 'Send an email confirming an order.',
      created_at: new Date().toISOString(),
    },
  ],
  route_steps: [
    { id: uuid(40), route_id: ROUTE.escalation, step_order: 0, tool_id: T.search, input_mapping: {}, rollback_input_mapping: null, fallback_input_mapping: null, fallback_rollback_input_mapping: null, output_capture_key: null, fallback_route_id: null, rollback_tool_id: null, created_at: new Date().toISOString() },
    { id: uuid(41), route_id: ROUTE.escalation, step_order: 1, tool_id: T.getCustomer, input_mapping: {}, rollback_input_mapping: null, fallback_input_mapping: null, fallback_rollback_input_mapping: null, output_capture_key: null, fallback_route_id: null, rollback_tool_id: null, created_at: new Date().toISOString() },
    { id: uuid(42), route_id: ROUTE.escalation, step_order: 2, tool_id: T.createTicket, input_mapping: {}, rollback_input_mapping: null, fallback_input_mapping: null, fallback_rollback_input_mapping: null, output_capture_key: null, fallback_route_id: null, rollback_tool_id: null, created_at: new Date().toISOString() },
    { id: uuid(43), route_id: ROUTE.notify, step_order: 0, tool_id: T.sendEmail, input_mapping: {}, rollback_input_mapping: null, fallback_input_mapping: null, fallback_rollback_input_mapping: null, output_capture_key: null, fallback_route_id: null, rollback_tool_id: null, created_at: new Date().toISOString() },
  ],
});

describe('validateWorkflow', () => {
  it('returns valid=true with no issues for a well-formed sequence', async () => {
    const manifest = baseManifest();
    const out = await validateWorkflow(
      { steps: [{ tool: 'searchCustomers' }, { tool: 'getCustomer' }, { tool: 'listCustomerOrders' }] },
      manifest,
    );
    expect(out.valid).toBe(true);
    expect(out.issues).toEqual([]);
    expect(out.graph_coverage).toBeCloseTo(1, 5);
  });

  it('flags unknown_tool errors and marks the workflow invalid', async () => {
    const manifest = baseManifest();
    const out = await validateWorkflow(
      { steps: [{ tool: 'searchCustomers' }, { tool: 'bogus_tool' }] },
      manifest,
    );
    expect(out.valid).toBe(false);
    const unknown = out.issues.filter((i) => i.code === 'unknown_tool');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.severity).toBe('error');
    expect(unknown[0]?.tool).toBe('bogus_tool');
  });

  it('warns when a requires_before predecessor is missing but still reports valid', async () => {
    const manifest = baseManifest();
    // createSupportTicket requires_before getCustomer; omit getCustomer from the sequence.
    const out = await validateWorkflow(
      { steps: [{ tool: 'searchCustomers' }, { tool: 'createSupportTicket' }] },
      manifest,
    );
    const warnings = out.issues.filter((i) => i.code === 'missing_prerequisite');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe('warning');
    expect(warnings[0]?.expected_preceding_tool).toBe('getCustomer');
    // No errors, valid stays true despite the warning.
    expect(out.valid).toBe(true);
  });

  it('errors on a mutually_exclusive adjacent pair', async () => {
    const manifest = baseManifest();
    const out = await validateWorkflow(
      { steps: [{ tool: 'createSupportTicket' }, { tool: 'sendEmail' }] },
      manifest,
    );
    expect(out.valid).toBe(false);
    const mx = out.issues.filter((i) => i.code === 'mutually_exclusive');
    expect(mx).toHaveLength(1);
    expect(mx[0]?.severity).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// evaluate_goal, keyword + Opus tiers.

// Hoisted mock state so the factory can reach it from inside the vi.mock call.
const mockState = vi.hoisted(() => ({
  nextReply: null as string | null,
  shouldThrow: false,
}));

vi.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = {
      create: async () => {
        if (mockState.shouldThrow) throw new Error('mocked anthropic failure');
        return {
          content: [{ type: 'text', text: mockState.nextReply ?? '{}' }],
        };
      },
    };
  }
  return { default: FakeAnthropic };
});

describe('evaluateGoal', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalModel = process.env.EVALUATE_GOAL_MODEL;

  beforeEach(() => {
    mockState.nextReply = null;
    mockState.shouldThrow = false;
    process.env.EVALUATE_GOAL_MODEL = 'claude-opus-4-7';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.EVALUATE_GOAL_MODEL;
    else process.env.EVALUATE_GOAL_MODEL = originalModel;
  });

  it('falls back to the keyword scorer when Opus is unreachable', async () => {
    process.env.ANTHROPIC_API_KEY = 'fake-key-forces-opus-attempt';
    mockState.shouldThrow = true;
    const manifest = baseManifest();
    const out = await evaluateGoal({ goal: 'open a support ticket for a customer' }, manifest);
    expect(out.candidates.length).toBeGreaterThan(0);
    // Top candidate should be the escalation route, more keyword overlap.
    expect(out.candidates[0]?.name).toBe('customer_escalation');
    // Relevance is normalised to [0, 1] against the top score.
    expect(out.candidates[0]?.relevance).toBe(1);
    // Sorted by relevance descending.
    const relevances = out.candidates.map((c) => c.relevance);
    for (let i = 1; i < relevances.length; i += 1) {
      expect(relevances[i - 1]).toBeGreaterThanOrEqual(relevances[i] ?? 0);
    }
  });

  it('uses the Opus ranker output when the SDK returns a parseable reply', async () => {
    process.env.ANTHROPIC_API_KEY = 'fake-key-forces-opus-attempt';
    mockState.nextReply = JSON.stringify({
      candidates: [
        {
          kind: 'route',
          id: ROUTE.notify,
          name: 'order_notification',
          steps: [{ tool_name: 'sendEmail', tool_id: T.sendEmail }],
          relevance: 0.92,
          rationale: 'Goal is about notifying a customer; this route sends email.',
        },
      ],
      rationale_overall: 'Chosen by Opus 4.7 for email-focused goal.',
    });
    const manifest = baseManifest();
    const out = await evaluateGoal(
      { goal: 'send an email to let the customer know their order shipped', max_candidates: 1 },
      manifest,
    );
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0]?.name).toBe('order_notification');
    expect(out.candidates[0]?.relevance).toBeCloseTo(0.92, 5);
    expect(out.rationale_overall).toContain('Opus 4.7');
  });
});
