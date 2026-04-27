import { describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@/lib/manifest/cache';

// Sprint 30 WP-30.2: stateless-server folds the TRel relationship graph into
// the standard `description` field via `formatToolDescription`. Standard MCP
// clients drop `_meta` so the description is the only field with provably
// 100% client coverage. These tests pin the wiring contract:
//   1. Tool with outgoing edges -> description gets the "— Workflow context —"
//      block appended.
//   2. Tool with `display_description` set -> manual override wins, no
//      enrichment.
//   3. Empty graph -> original description preserved verbatim.
//   4. Builtin echo -> never enriched (no manifest row).

vi.mock('@/lib/supabase/service', async () => {
  const { stubServiceClientFactory } = await import('./_helpers/supabase-stub');
  return await stubServiceClientFactory();
});

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const SERVER_ID = uuid(1);
const SEARCH_ID = uuid(10);
const GET_CUSTOMER_ID = uuid(11);
const ROUTE_ID = uuid(20);
const OVERRIDE_ID = uuid(30);
const ORPHAN_ID = uuid(40);

const enrichedManifest: Manifest = {
  loadedAt: Date.now(),
  servers: [
    {
      id: SERVER_ID,
      organization_id: uuid(100),
      domain_id: null,
      name: 'demo',
      origin_url: 'https://example.test',
      transport: 'openapi',
      openapi_spec: {},
      auth_config: null,
      created_at: new Date(0).toISOString(),
    },
  ],
  tools: [
    {
      id: SEARCH_ID,
      server_id: SERVER_ID,
      name: 'searchCustomers',
      description: 'Searches the CRM for customers matching a query.',
      input_schema: { type: 'object' },
    },
    {
      id: GET_CUSTOMER_ID,
      server_id: SERVER_ID,
      name: 'getCustomer',
      description: 'Fetches a customer by id.',
      input_schema: { type: 'object' },
    },
    {
      id: OVERRIDE_ID,
      server_id: SERVER_ID,
      name: 'archiveCustomer',
      description: 'Origin description that should be hidden.',
      input_schema: { type: 'object' },
      display_description: 'Manual override wins, ignore the graph.',
    },
    {
      id: ORPHAN_ID,
      server_id: SERVER_ID,
      name: 'orphanTool',
      description: 'Bare tool with no graph context.',
      input_schema: { type: 'object' },
    },
  ],
  relationships: [
    {
      id: uuid(50),
      from_tool_id: SEARCH_ID,
      to_tool_id: GET_CUSTOMER_ID,
      relationship_type: 'produces_input_for',
      description: 'search returns ids that getCustomer consumes',
    },
  ],
  policies: [],
  assignments: [],
  routes: [
    {
      id: ROUTE_ID,
      organization_id: uuid(100),
      domain_id: null,
      name: 'Customer Lookup Saga',
      description: null,
      created_at: new Date(0).toISOString(),
    },
  ],
  route_steps: [
    {
      id: uuid(60),
      route_id: ROUTE_ID,
      step_order: 1,
      tool_id: SEARCH_ID,
      input_mapping: {},
      rollback_input_mapping: null,
      fallback_input_mapping: null,
      fallback_rollback_input_mapping: null,
      output_capture_key: 'search',
      fallback_route_id: null,
      rollback_tool_id: null,
      created_at: new Date(0).toISOString(),
    },
    {
      id: uuid(61),
      route_id: ROUTE_ID,
      step_order: 2,
      tool_id: GET_CUSTOMER_ID,
      input_mapping: {},
      rollback_input_mapping: null,
      fallback_input_mapping: null,
      fallback_rollback_input_mapping: null,
      output_capture_key: 'customer',
      fallback_route_id: null,
      // Step 2 carries a rollback tool, route-level hasRollback flag should fire.
      rollback_tool_id: OVERRIDE_ID,
      created_at: new Date(0).toISOString(),
    },
  ],
};

const emptyGraphManifest: Manifest = {
  loadedAt: Date.now(),
  servers: enrichedManifest.servers,
  tools: [
    {
      id: SEARCH_ID,
      server_id: SERVER_ID,
      name: 'searchCustomers',
      description: 'Searches the CRM for customers matching a query.',
      input_schema: { type: 'object' },
    },
  ],
  relationships: [],
  policies: [],
  assignments: [],
  routes: [],
  route_steps: [],
};

let manifestToServe: Manifest = enrichedManifest;

vi.mock('@/lib/manifest/cache', async () => {
  const actual = await vi.importActual<typeof import('@/lib/manifest/cache')>(
    '@/lib/manifest/cache',
  );
  return {
    ...actual,
    loadManifest: async () => manifestToServe,
  };
});

vi.mock('@/lib/mcp/auth-token', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/mcp/auth-token')>(
      '@/lib/mcp/auth-token',
    );
  return {
    ...actual,
    resolveOrgFromToken: async () => ({ ok: true, organization_id: uuid(100) }),
  };
});

const { POST } = await import('@/app/api/mcp/route');

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const rpc = async (body: unknown): Promise<Response> => {
  const request = new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer test-token',
    },
    body: JSON.stringify(body),
  });
  return POST(request);
};

const readJson = async (res: Response): Promise<JsonRpcResponse> => {
  const text = await res.text();
  const sseMatch = text.match(/data:\s*(\{[\s\S]*\})/);
  const payload = sseMatch ? sseMatch[1] : text;
  return JSON.parse(payload) as JsonRpcResponse;
};

type ToolEntry = { name: string; description: string };

describe('stateless-server description enrichment (WP-30.2)', () => {
  it('enriches a tool with outgoing edges and route membership', async () => {
    manifestToServe = enrichedManifest;
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();

    const tools = body.result?.tools as ToolEntry[] | undefined;
    expect(tools).toBeDefined();

    const search = tools?.find((t) => t.name === 'searchCustomers');
    expect(search).toBeDefined();

    expect(search?.description).toContain('Searches the CRM for customers matching a query.');
    expect(search?.description).toContain('— Workflow context —');
    expect(search?.description).toContain('After this tool, typically call:');
    expect(search?.description).toContain('getCustomer');
    expect(search?.description).toContain(
      "Part of route: Customer Lookup Saga (2 steps with rollback) — prefer execute_route('Customer Lookup Saga')",
    );
  });

  it('enriches downstream tool with route membership only when no outgoing edges', async () => {
    manifestToServe = enrichedManifest;
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const getCustomer = tools?.find((t) => t.name === 'getCustomer');
    expect(getCustomer).toBeDefined();
    expect(getCustomer?.description).toContain('Fetches a customer by id.');
    expect(getCustomer?.description).toContain('— Workflow context —');
    expect(getCustomer?.description).toContain('Part of route: Customer Lookup Saga');
  });

  it('skips enrichment when display_description is set (manual override wins)', async () => {
    manifestToServe = enrichedManifest;
    const res = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const archived = tools?.find((t) => t.name === 'archiveCustomer');
    expect(archived).toBeDefined();
    expect(archived?.description).toBe('Manual override wins, ignore the graph.');
    expect(archived?.description).not.toContain('— Workflow context —');
  });

  it('returns the original description verbatim on a bare tool with no edges or routes', async () => {
    manifestToServe = enrichedManifest;
    const res = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const orphan = tools?.find((t) => t.name === 'orphanTool');
    expect(orphan).toBeDefined();
    expect(orphan?.description).toBe('Bare tool with no graph context.');
    expect(orphan?.description).not.toContain('— Workflow context —');
  });

  it('preserves original descriptions when the manifest graph is empty', async () => {
    manifestToServe = emptyGraphManifest;
    const res = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const search = tools?.find((t) => t.name === 'searchCustomers');
    expect(search).toBeDefined();
    expect(search?.description).toBe('Searches the CRM for customers matching a query.');
    expect(search?.description).not.toContain('— Workflow context —');
  });

  it('does not enrich the builtin echo tool', async () => {
    manifestToServe = enrichedManifest;
    const res = await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const echo = tools?.find((t) => t.name === 'echo');
    expect(echo).toBeDefined();
    expect(echo?.description).not.toContain('— Workflow context —');
  });
});
