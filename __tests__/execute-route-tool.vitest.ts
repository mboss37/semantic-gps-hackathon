import { describe, expect, it } from 'vitest';
import {
  EXECUTE_ROUTE_TOOL_NAME,
  buildExecuteRouteToolDescriptor,
  resolveExecuteRouteParams,
} from '@/lib/mcp/execute-route-tool';
import type {
  RelationshipRow,
  RouteRow,
  RouteStepRow,
} from '@/lib/manifest/cache';

const route = (overrides: Partial<RouteRow> = {}): RouteRow => ({
  id: 'r-1',
  organization_id: 'org-1',
  domain_id: null,
  name: 'sales_escalation',
  description: 'Find an account, look up the contact, log a follow-up task.',
  created_at: '2026-04-27T00:00:00.000Z',
  ...overrides,
});

const step = (overrides: Partial<RouteStepRow> = {}): RouteStepRow => ({
  id: 's-1',
  route_id: 'r-1',
  step_order: 1,
  tool_id: 't-1',
  input_mapping: {},
  rollback_input_mapping: null,
  fallback_input_mapping: null,
  fallback_rollback_input_mapping: null,
  output_capture_key: null,
  fallback_route_id: null,
  rollback_tool_id: null,
  created_at: '2026-04-27T00:00:00.000Z',
  ...overrides,
});

const rel = (overrides: Partial<RelationshipRow> = {}): RelationshipRow => ({
  id: 'rel-1',
  from_tool_id: 't-1',
  to_tool_id: 't-2',
  relationship_type: 'produces_input_for',
  description: 'noop',
  ...overrides,
});

describe('EXECUTE_ROUTE_TOOL_NAME', () => {
  it('is the literal string "execute_route" — locks the wire contract', () => {
    expect(EXECUTE_ROUTE_TOOL_NAME).toBe('execute_route');
  });
});

describe('buildExecuteRouteToolDescriptor', () => {
  it('returns null when there are no routes (no point exposing an empty orchestrator)', () => {
    expect(buildExecuteRouteToolDescriptor([], [], [])).toBeNull();
  });

  it('renders one available-route line per route with name + step count', () => {
    const routes = [
      route({ id: 'r-1', name: 'sales_escalation' }),
      route({ id: 'r-2', name: 'cross_domain_escalation' }),
    ];
    const steps = [
      step({ id: 's-1', route_id: 'r-1', step_order: 1, tool_id: 't-a' }),
      step({ id: 's-2', route_id: 'r-1', step_order: 2, tool_id: 't-b' }),
      step({ id: 's-3', route_id: 'r-1', step_order: 3, tool_id: 't-c' }),
      step({ id: 's-4', route_id: 'r-2', step_order: 1, tool_id: 't-d' }),
      step({ id: 's-5', route_id: 'r-2', step_order: 2, tool_id: 't-e' }),
    ];
    const result = buildExecuteRouteToolDescriptor(routes, steps, []);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('execute_route');
    expect(result?.description).toContain('• sales_escalation (3 steps)');
    expect(result?.description).toContain('• cross_domain_escalation (2 steps)');
  });

  it('annotates routes with rollback / fallback guards when relationships back the steps', () => {
    const routes = [route({ id: 'r-1', name: 'cross_domain_escalation' })];
    const steps = [
      step({ id: 's-1', route_id: 'r-1', step_order: 1, tool_id: 't-write' }),
    ];
    const relationships = [
      rel({
        id: 'rel-rb',
        from_tool_id: 't-write',
        to_tool_id: 't-undo',
        relationship_type: 'compensated_by',
      }),
      rel({
        id: 'rel-fb',
        from_tool_id: 't-write',
        to_tool_id: 't-degraded',
        relationship_type: 'fallback_to',
      }),
    ];
    const result = buildExecuteRouteToolDescriptor(routes, steps, relationships);
    expect(result?.description).toContain('rollback + fallback');
  });

  it('emits a JSON-Schema input shape with route_name, route_id, inputs', () => {
    const result = buildExecuteRouteToolDescriptor([route()], [step()], []);
    expect(result?.inputSchema).toMatchObject({
      type: 'object',
      required: ['inputs'],
      properties: {
        route_name: expect.objectContaining({ type: 'string' }),
        route_id: expect.objectContaining({ type: 'string' }),
        inputs: expect.objectContaining({ type: 'object' }),
      },
    });
  });
});

describe('resolveExecuteRouteParams', () => {
  const routes = [
    route({ id: 'r-uuid-aaa', name: 'sales_escalation' }),
    route({ id: 'r-uuid-bbb', name: 'cross_domain_escalation' }),
  ];

  it('resolves route_name → route_id and forwards inputs verbatim', () => {
    const out = resolveExecuteRouteParams(
      { route_name: 'sales_escalation', inputs: { account_name: 'Acme' } },
      routes,
    );
    expect(out).toEqual({
      ok: true,
      route_id: 'r-uuid-aaa',
      inputs: { account_name: 'Acme' },
    });
  });

  it('accepts route_id directly when supplied', () => {
    const out = resolveExecuteRouteParams(
      { route_id: 'r-uuid-bbb', inputs: { x: 1 } },
      routes,
    );
    expect(out).toEqual({
      ok: true,
      route_id: 'r-uuid-bbb',
      inputs: { x: 1 },
    });
  });

  it('prefers route_name when both are provided (more agent-friendly)', () => {
    const out = resolveExecuteRouteParams(
      {
        route_name: 'sales_escalation',
        route_id: 'r-uuid-bbb',
        inputs: {},
      },
      routes,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.route_id).toBe('r-uuid-aaa');
  });

  it('returns a typed error with known-route hint when route_name is unknown', () => {
    const out = resolveExecuteRouteParams(
      { route_name: 'nope', inputs: {} },
      routes,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("route 'nope' not found");
      expect(out.error).toContain('sales_escalation');
      expect(out.error).toContain('cross_domain_escalation');
    }
  });

  it('returns a typed error when route_id is unknown', () => {
    const out = resolveExecuteRouteParams(
      { route_id: 'r-not-real', inputs: {} },
      routes,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("route_id 'r-not-real' not in this scope");
  });

  it('returns a typed error when neither route_name nor route_id is provided', () => {
    const out = resolveExecuteRouteParams({ inputs: { foo: 'bar' } }, routes);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain('either route_name or route_id');
  });

  it('defaults inputs to {} when caller omits the field', () => {
    const out = resolveExecuteRouteParams({ route_name: 'sales_escalation' }, routes);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.inputs).toEqual({});
  });

  it('coerces non-object inputs to {} (never trusts arbitrary client shapes)', () => {
    const malformed = resolveExecuteRouteParams(
      { route_name: 'sales_escalation', inputs: 'not-an-object' },
      routes,
    );
    expect(malformed.ok).toBe(true);
    if (malformed.ok) expect(malformed.inputs).toEqual({});

    const arr = resolveExecuteRouteParams(
      { route_name: 'sales_escalation', inputs: ['x', 'y'] },
      routes,
    );
    expect(arr.ok).toBe(true);
    if (arr.ok) expect(arr.inputs).toEqual({});
  });
});
