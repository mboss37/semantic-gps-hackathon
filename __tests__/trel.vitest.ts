import { describe, expect, it } from 'vitest';
import type { Manifest, RelationshipRow } from '@/lib/manifest/cache';
import { discoverRelationships, findWorkflowPath } from '@/lib/mcp/trel-handlers';

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SERVER_A = uuid(1);
const SERVER_B = uuid(2);
const T = {
  search: uuid(10),
  getCustomer: uuid(11),
  listOrders: uuid(12),
  createTicket: uuid(13),
  sendEmail: uuid(14),
  unrelated: uuid(15),
} as const;

const manifest: Manifest = {
  loadedAt: Date.now(),
  servers: [],
  tools: [
    { id: T.search, server_id: SERVER_A, name: 'searchCustomers', description: 'Search customers by name or email.', input_schema: {} },
    { id: T.getCustomer, server_id: SERVER_A, name: 'getCustomer', description: 'Fetch a single customer record.', input_schema: {} },
    { id: T.listOrders, server_id: SERVER_A, name: 'listCustomerOrders', description: 'List recent orders for a customer.', input_schema: {} },
    { id: T.createTicket, server_id: SERVER_A, name: 'createSupportTicket', description: 'Open a support ticket.', input_schema: {} },
    { id: T.sendEmail, server_id: SERVER_A, name: 'sendEmail', description: 'Send transactional email.', input_schema: {} },
    { id: T.unrelated, server_id: SERVER_B, name: 'otherServerTool', description: 'Belongs to another server.', input_schema: {} },
  ],
  relationships: [
    { id: uuid(20), from_tool_id: T.search, to_tool_id: T.getCustomer, relationship_type: 'produces_input_for', description: 'search finds IDs that getCustomer consumes' },
    { id: uuid(21), from_tool_id: T.getCustomer, to_tool_id: T.listOrders, relationship_type: 'produces_input_for', description: 'customer data informs order lookup' },
    { id: uuid(22), from_tool_id: T.listOrders, to_tool_id: T.createTicket, relationship_type: 'suggests_after', description: 'tickets commonly follow an order lookup' },
    { id: uuid(23), from_tool_id: T.createTicket, to_tool_id: T.sendEmail, relationship_type: 'alternative_to', description: 'can send email instead of a ticket' },
    { id: uuid(24), from_tool_id: T.getCustomer, to_tool_id: T.createTicket, relationship_type: 'requires_before', description: 'ticket requires customer — reverse-sense edge for BFS coverage' },
  ],
  policies: [],
  assignments: [],
  routes: [],
  route_steps: [],
};

describe('discoverRelationships', () => {
  it('returns all nodes + edges when no server_id is provided', async () => {
    const out = await discoverRelationships(undefined, manifest);
    expect(out.nodes).toHaveLength(6);
    expect(out.edges).toHaveLength(5);
  });

  it('scopes to a single server and drops edges that leave the scope', async () => {
    const out = await discoverRelationships({ server_id: SERVER_B }, manifest);
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0]?.name).toBe('otherServerTool');
    expect(out.edges).toHaveLength(0);
  });
});

describe('findWorkflowPath', () => {
  it('BFS-walks forward edges from an explicit starting_tool', async () => {
    const out = await findWorkflowPath(
      { goal: 'open a support ticket for a customer', starting_tool: 'searchCustomers', max_depth: 4 },
      manifest,
    );
    const names = out.path.map((s) => s.name);
    expect(names[0]).toBe('searchCustomers');
    expect(names).toContain('getCustomer');
    expect(names).toContain('createSupportTicket');
    // BFS only walks forward edges (produces_input_for / suggests_after / alternative_to),
    // so the `requires_before` edge getCustomer→createTicket must NOT be followed.
    // sendEmail is reachable via alternative_to from createSupportTicket.
    expect(names).toContain('sendEmail');
    expect(names).not.toContain('otherServerTool');
    const start = out.path.find((s) => s.reason === 'start');
    expect(start?.name).toBe('searchCustomers');
    expect(out.path.some((s) => s.reason === 'goal_match')).toBe(true);
  });

  it('returns an empty path with a rationale when nothing matches', async () => {
    const out = await findWorkflowPath(
      { goal: 'provision kubernetes clusters on jupiter' },
      manifest,
    );
    expect(out.path).toHaveLength(0);
    expect(out.rationale).toMatch(/no tool matched/i);
  });
});

describe('relationship taxonomy guard', () => {
  it('accepts all 8 canonical types and rejects anything else at the type level', () => {
    // Exhaustive list of valid types — assigning each one must compile.
    const valid: ReadonlyArray<RelationshipRow['relationship_type']> = [
      'produces_input_for',
      'requires_before',
      'suggests_after',
      'mutually_exclusive',
      'alternative_to',
      'validates',
      'compensated_by',
      'fallback_to',
    ];
    expect(valid).toHaveLength(8);

    // The following row uses a retired type and MUST fail typecheck. This
    // stands in for the DB CHECK constraint that rejects the same string at
    // runtime (exercised in the migration's integration path, not here).
    const bad = {
      id: uuid(99),
      from_tool_id: T.search,
      to_tool_id: T.getCustomer,
      // @ts-expect-error — 'depends_on' is not in the canonical 8 types.
      relationship_type: 'depends_on',
      description: 'retired type, must be rejected',
    } satisfies RelationshipRow;
    expect(bad.description).toContain('retired');
  });
});
