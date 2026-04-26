import { describe, expect, it, vi } from 'vitest';
import type { Manifest } from '@/lib/manifest/cache';

// Stub service client on CI, loadManifest is mocked below, but the route
// also fires logMCPEvent through the service client.
vi.mock('@/lib/supabase/service', async () => {
  const { stubServiceClientFactory } = await import('./_helpers/supabase-stub');
  return await stubServiceClientFactory();
});

// WP-G.6: when a manifest tool row carries `display_name` /
// `display_description`, `tools/list` must emit those instead of the origin
// fields. Null display fields fall back to origin. `tools/call` must accept
// EITHER origin or display name. Mock `loadManifest` so we can seed a
// deterministic graph without Postgres.
const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const SERVER_ID = uuid(1);
const RENAMED_ID = uuid(10);
const ORIGINAL_ID = uuid(11);

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
      id: RENAMED_ID,
      server_id: SERVER_ID,
      name: 'orig_name',
      description: 'origin description',
      input_schema: { type: 'object' },
      display_name: 'friendly_name',
      display_description: 'Claude-friendly description',
    },
    {
      id: ORIGINAL_ID,
      server_id: SERVER_ID,
      name: 'untouched_tool',
      description: 'origin only',
      input_schema: { type: 'object' },
      display_name: null,
      display_description: null,
    },
  ],
  relationships: [],
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

// Bearer-auth resolver is mocked so the route serves without a live DB; the
// real service client stays in play so logMCPEvent's fire-and-forget insert
// doesn't crash on a missing `.from()`.
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

type ToolEntry = { name: string; description: string };

describe('semantic rewriting layer (WP-G.6)', () => {
  it('emits display_name + display_description when set', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    const tools = body.result?.tools as ToolEntry[] | undefined;
    expect(tools).toBeDefined();

    const renamed = tools?.find(
      (t) => t.name === 'friendly_name' || t.name === 'orig_name',
    );
    expect(renamed).toBeDefined();
    expect(renamed?.name).toBe('friendly_name');
    expect(renamed?.description).toBe('Claude-friendly description');

    // origin name must NOT leak when a display alias exists
    const origLeaked = tools?.find((t) => t.name === 'orig_name');
    expect(origLeaked).toBeUndefined();
  });

  it('falls back to origin name + description when display fields are null', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const body = await readJson(res);
    const tools = body.result?.tools as ToolEntry[] | undefined;

    const untouched = tools?.find((t) => t.name === 'untouched_tool');
    expect(untouched).toBeDefined();
    expect(untouched?.description).toBe('origin only');
  });

  it('accepts tools/call by display_name (dispatcher still lookups by origin)', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'friendly_name', arguments: { hello: 'world' } },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    // Not found would surface as an isError text response; a content block
    // means the dispatcher mapped display_name → origin_name successfully.
    expect(body.result?.isError).not.toBe(true);
  });

  it('accepts tools/call by origin name even when a display alias exists', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'orig_name', arguments: { hello: 'world' } },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.result?.isError).not.toBe(true);
  });
});
