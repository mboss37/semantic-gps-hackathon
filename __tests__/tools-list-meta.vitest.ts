import { describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@/lib/manifest/cache';

// Stub service client on CI — loadManifest is mocked below, but the route
// also fires logMCPEvent through the service client.
vi.mock('@/lib/supabase/service', async () => {
  const { stubServiceClientFactory } = await import('./_helpers/supabase-stub');
  return await stubServiceClientFactory();
});

// WP-C.5: tools/list must attach `_meta.relationships` to any tool with
// outgoing edges in the manifest. Mock `loadManifest` so we can seed a
// deterministic tools+relationships graph without hitting Postgres.
const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const SERVER_ID = uuid(1);
const SEARCH_ID = uuid(10);
const GET_CUSTOMER_ID = uuid(11);
const ORPHAN_ID = uuid(12);

const testManifest: Manifest = {
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
      description: 'search customers',
      input_schema: { type: 'object' },
    },
    {
      id: GET_CUSTOMER_ID,
      server_id: SERVER_ID,
      name: 'getCustomer',
      description: 'fetch a customer',
      input_schema: { type: 'object' },
    },
    {
      id: ORPHAN_ID,
      server_id: SERVER_ID,
      name: 'orphanTool',
      description: 'no outgoing edges',
      input_schema: { type: 'object' },
    },
  ],
  relationships: [
    {
      id: uuid(20),
      from_tool_id: SEARCH_ID,
      to_tool_id: GET_CUSTOMER_ID,
      relationship_type: 'produces_input_for',
      description: 'search finds IDs that getCustomer consumes',
    },
  ],
  policies: [],
  assignments: [],
  routes: [],
  route_steps: [],
};

vi.mock('@/lib/manifest/cache', async () => {
  const actual = await vi.importActual<typeof import('@/lib/manifest/cache')>(
    '@/lib/manifest/cache',
  );
  return {
    ...actual,
    loadManifest: async () => testManifest,
  };
});

// Bearer-auth stub so the route gets a resolved org without a live DB.
// Service client stays real — logMCPEvent's insert is fire-and-forget.
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

// Import AFTER the mocks are declared so the route picks up the stubbed modules.
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

type ToolEntry = {
  name: string;
  _meta?: { relationships?: Array<{ to: string; type: string; description: string }> };
};

describe('tools/list _meta.relationships (WP-C.5)', () => {
  it('attaches outgoing edges to the source tool under _meta', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    const tools = body.result?.tools as ToolEntry[] | undefined;
    expect(tools).toBeDefined();

    const search = tools?.find((t) => t.name === 'searchCustomers');
    expect(search).toBeDefined();
    expect(search?._meta?.relationships).toHaveLength(1);
    expect(search?._meta?.relationships?.[0]).toEqual({
      to: 'getCustomer',
      type: 'produces_input_for',
      description: 'search finds IDs that getCustomer consumes',
    });
  });

  it('omits _meta entirely on tools with no outgoing edges', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    // `getCustomer` has an *incoming* edge but no outgoing edge — _meta stays off.
    const getCustomer = tools?.find((t) => t.name === 'getCustomer');
    expect(getCustomer?._meta).toBeUndefined();

    // `orphanTool` has neither in nor out — _meta stays off.
    const orphan = tools?.find((t) => t.name === 'orphanTool');
    expect(orphan?._meta).toBeUndefined();

    // `echo` is the builtin — no manifest row, so no edges. _meta stays off.
    const echo = tools?.find((t) => t.name === 'echo');
    expect(echo?._meta).toBeUndefined();
  });
});
