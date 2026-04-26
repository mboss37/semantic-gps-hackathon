import { describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@/lib/manifest/cache';

// Playground A/B hero, ungoverned MCP surface. Asserts the /api/mcp/raw
// endpoint strips the control plane:
//   - tools/list emits origin names, no display rewriting, no _meta.relationships
//   - tools/call dispatches but never fires policy pre/post hooks
//   - TRel extensions + execute_route return -32601 method_not_found
// Still requires bearer auth, "ungoverned" means no policy stack, NOT "open
// to the world".

vi.mock('@/lib/supabase/service', async () => {
  const { stubServiceClientFactory } = await import('./_helpers/supabase-stub');
  return await stubServiceClientFactory();
});

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ORG_ID = uuid(100);
const SERVER_ID = uuid(1);
const SEARCH_ID = uuid(10);
const GET_CUSTOMER_ID = uuid(11);
const POLICY_ID = uuid(50);

const testManifest: Manifest = {
  loadedAt: Date.now(),
  servers: [
    {
      id: SERVER_ID,
      organization_id: ORG_ID,
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
      description: 'origin description for search',
      input_schema: { type: 'object' },
      display_name: 'friendly_search',
      display_description: 'Claude-friendly search description',
    },
    {
      id: GET_CUSTOMER_ID,
      server_id: SERVER_ID,
      name: 'getCustomer',
      description: 'fetch a customer',
      input_schema: { type: 'object' },
    },
  ],
  // Relationship present on the governed surface; raw endpoint must drop it.
  relationships: [
    {
      id: uuid(20),
      from_tool_id: SEARCH_ID,
      to_tool_id: GET_CUSTOMER_ID,
      relationship_type: 'produces_input_for',
      description: 'search finds IDs that getCustomer consumes',
    },
  ],
  // Policy assigned to searchCustomers. On the governed surface this would
  // fire a pre-call decision; on raw it must be skipped entirely.
  policies: [
    {
      id: POLICY_ID,
      organization_id: ORG_ID,
      name: 'pii-redaction',
      builtin_key: 'pii_redaction',
      config: { fields: ['ssn', 'email'] },
      enforcement_mode: 'enforce',
      version: 1,
    } as unknown as Manifest['policies'][number],
  ],
  assignments: [
    {
      policy_id: POLICY_ID,
      server_id: SERVER_ID,
      tool_id: SEARCH_ID,
    } as unknown as Manifest['assignments'][number],
  ],
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

vi.mock('@/lib/mcp/auth-token', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/mcp/auth-token')>(
      '@/lib/mcp/auth-token',
    );
  return {
    ...actual,
    resolveOrgFromToken: async () => ({ ok: true, organization_id: ORG_ID }),
  };
});

// Spy on policy enforcement so we can assert it's never called on raw.
const preCallSpy = vi.fn();
const postCallSpy = vi.fn();
vi.mock('@/lib/policies/enforce', async () => {
  const actual = await vi.importActual<typeof import('@/lib/policies/enforce')>(
    '@/lib/policies/enforce',
  );
  return {
    ...actual,
    runPreCallPolicies: (...args: Parameters<typeof actual.runPreCallPolicies>) => {
      preCallSpy(...args);
      return actual.runPreCallPolicies(...args);
    },
    runPostCallPolicies: (...args: Parameters<typeof actual.runPostCallPolicies>) => {
      postCallSpy(...args);
      return actual.runPostCallPolicies(...args);
    },
  };
});

// Force the mock path so we don't need a real upstream, keeps the test
// deterministic while still exercising tools/call end-to-end.
process.env.REAL_PROXY_ENABLED = '0';

const { POST } = await import('@/app/api/mcp/raw/route');

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const rpc = async (body: unknown): Promise<Response> => {
  const request = new Request('http://localhost/api/mcp/raw', {
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
  description: string;
  _meta?: { relationships?: unknown };
};

describe('ungoverned MCP surface /api/mcp/raw', () => {
  it('rejects unauthenticated calls, bearer still required', async () => {
    const request = new Request('http://localhost/api/mcp/raw', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    const res = await POST(request);
    expect(res.status).toBe(401);
  });

  it('tools/list returns origin names without display rewriting', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    const tools = body.result?.tools as ToolEntry[] | undefined;
    expect(tools).toBeDefined();

    // Origin name must win, display_name never leaks on the raw surface.
    const search = tools?.find((t) => t.name === 'searchCustomers');
    expect(search).toBeDefined();
    expect(search?.description).toBe('origin description for search');

    const friendly = tools?.find((t) => t.name === 'friendly_search');
    expect(friendly).toBeUndefined();
  });

  it('tools/list strips _meta.relationships on every tool', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const search = tools?.find((t) => t.name === 'searchCustomers');
    // Governed surface would emit _meta.relationships for searchCustomers;
    // raw must drop it entirely.
    expect(search?._meta).toBeUndefined();

    // Builtin echo is always bare, sanity check the baseline.
    const echo = tools?.find((t) => t.name === 'echo');
    expect(echo?._meta).toBeUndefined();
  });

  it('tools/call dispatches without running policies', async () => {
    preCallSpy.mockClear();
    postCallSpy.mockClear();
    const res = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'searchCustomers', arguments: { query: 'Edge' } },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).not.toBe(true);

    // The contrast: governed would fire both pre + post for a PII-assigned
    // tool. Raw bypasses the enforce pipeline entirely.
    expect(preCallSpy).not.toHaveBeenCalled();
    expect(postCallSpy).not.toHaveBeenCalled();
  });

  it('echo builtin still works on the raw surface', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 'raw alive' } },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    const content = body.result?.content as Array<{ type: string; text: string }> | undefined;
    expect(content?.[0]?.text).toBe('raw alive');
  });

  it('discover_relationships returns method_not_found', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'discover_relationships',
      params: {},
    });
    const body = await readJson(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('find_workflow_path returns method_not_found', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'find_workflow_path',
      params: { goal: 'anything' },
    });
    const body = await readJson(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('validate_workflow returns method_not_found', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 7,
      method: 'validate_workflow',
      params: { steps: [{ tool: 'searchCustomers' }] },
    });
    const body = await readJson(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('evaluate_goal returns method_not_found', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 8,
      method: 'evaluate_goal',
      params: { goal: 'find edge customer' },
    });
    const body = await readJson(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('execute_route returns method_not_found', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 9,
      method: 'execute_route',
      params: { route_id: uuid(999), inputs: {} },
    });
    const body = await readJson(res);
    expect(body.error?.code).toBe(-32601);
  });
});
