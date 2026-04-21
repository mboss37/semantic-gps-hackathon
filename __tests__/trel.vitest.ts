import { describe, expect, it } from 'vitest';
import type { Manifest } from '@/lib/manifest/cache';
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
    { id: uuid(20), from_tool_id: T.search, to_tool_id: T.getCustomer, relationship_type: 'enables', description: 'search finds IDs that getCustomer consumes' },
    { id: uuid(21), from_tool_id: T.getCustomer, to_tool_id: T.listOrders, relationship_type: 'enables', description: 'customer data informs order lookup' },
    { id: uuid(22), from_tool_id: T.listOrders, to_tool_id: T.createTicket, relationship_type: 'composes_into', description: 'tickets reference orders' },
    { id: uuid(23), from_tool_id: T.createTicket, to_tool_id: T.sendEmail, relationship_type: 'alternative_to', description: 'can send email instead of a ticket' },
    { id: uuid(24), from_tool_id: T.getCustomer, to_tool_id: T.createTicket, relationship_type: 'depends_on', description: 'ticket requires customer — reverse edge, not followed by BFS' },
  ],
  policies: [],
  assignments: [],
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
    // Reverse-direction depends_on from getCustomer → createTicket must NOT be followed
    // (we only follow composes_into / enables / alternative_to).
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
