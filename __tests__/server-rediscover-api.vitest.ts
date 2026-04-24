import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 14 WP-14.3 + batch-upsert refactor: /api/servers/[id]/rediscover.
// Exercises the diff-and-upsert path against a chain-stub Supabase, with
// discoverTools mocked. Asserts: batch upsert fires, GET preview returns
// diff shape, 502 on origin unreachable.

const { requireAuthMock, discoverToolsMock, invalidateManifestMock, decodeAuthConfigMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    discoverToolsMock: vi.fn(),
    invalidateManifestMock: vi.fn(),
    decodeAuthConfigMock: vi.fn(),
  }));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    requireAuth: requireAuthMock,
  };
});

vi.mock('@/lib/mcp/discover-tools', () => ({
  discoverTools: discoverToolsMock,
}));

vi.mock('@/lib/manifest/cache', () => ({
  invalidateManifest: invalidateManifestMock,
}));

vi.mock('@/lib/servers/auth', () => ({
  decodeAuthConfig: decodeAuthConfigMock,
}));

const SERVER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type ExistingToolRow = {
  id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  display_name: string | null;
  display_description: string | null;
};

type UpsertCall = {
  table: string;
  rows: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
};

type StubOptions = {
  server: { id: string; origin_url: string | null; auth_config: unknown; organization_id: string } | null;
  existingTools: ExistingToolRow[];
};

const makeStubSupabase = (opts: StubOptions) => {
  const upsertCalls: UpsertCall[] = [];

  const stub = {
    from: (table: string) => {
      if (table === 'servers') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: () => {
                const match = opts.server && opts.server.id === value ? opts.server : null;
                return Promise.resolve({ data: match, error: null });
              },
            }),
          }),
        };
      }
      if (table === 'tools') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _value: string) =>
              Promise.resolve({ data: opts.existingTools, error: null }),
          }),
          upsert: (rows: Array<Record<string, unknown>>, options: Record<string, unknown>) => {
            upsertCalls.push({ table, rows, options });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  return { stub, upsertCalls };
};

const { POST, GET } = await import('@/app/api/servers/[id]/rediscover/route');

const makePostRequest = () =>
  new Request(`http://localhost/api/servers/${SERVER_ID}/rediscover`, { method: 'POST' });

const makeGetRequest = () =>
  new Request(`http://localhost/api/servers/${SERVER_ID}/rediscover`, { method: 'GET' });

describe('server rediscover API', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    discoverToolsMock.mockReset();
    invalidateManifestMock.mockReset();
    decodeAuthConfigMock.mockReset();
    decodeAuthConfigMock.mockReturnValue({ type: 'none' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('POST: upserts all discovered tools in a single batch, reports counts', async () => {
    const { stub, upsertCalls } = makeStubSupabase({
      server: {
        id: SERVER_ID,
        origin_url: 'https://example.test/mcp',
        auth_config: null,
        organization_id: 'org-a',
      },
      existingTools: [
        {
          id: 't1',
          name: 'foo',
          description: 'old desc',
          input_schema: null,
          display_name: 'Foo Custom',
          display_description: 'desc',
        },
      ],
    });

    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    discoverToolsMock.mockResolvedValue({
      ok: true,
      tools: [
        { name: 'foo', description: 'new desc', inputSchema: { type: 'object' } },
        { name: 'bar', description: 'fresh tool', inputSchema: { type: 'object' } },
      ],
    });

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { added: number; updated: number; stale: number };
    expect(body).toEqual({ added: 1, updated: 1, stale: 0 });

    expect(invalidateManifestMock).toHaveBeenCalledOnce();

    // Single upsert call with both tools
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].options).toEqual({
      onConflict: 'server_id,name',
      ignoreDuplicates: false,
    });
    expect(upsertCalls[0].rows).toEqual([
      {
        server_id: SERVER_ID,
        name: 'foo',
        description: 'new desc',
        input_schema: { type: 'object' },
      },
      {
        server_id: SERVER_ID,
        name: 'bar',
        description: 'fresh tool',
        input_schema: { type: 'object' },
      },
    ]);

    // Upsert does NOT include display_name / display_description — preserves overrides
    for (const row of upsertCalls[0].rows) {
      expect(row).not.toHaveProperty('display_name');
      expect(row).not.toHaveProperty('display_description');
    }
  });

  it('POST: counts stale tools (existing name not in discovery)', async () => {
    const { stub } = makeStubSupabase({
      server: {
        id: SERVER_ID,
        origin_url: 'https://example.test/mcp',
        auth_config: null,
        organization_id: 'org-a',
      },
      existingTools: [
        { id: 't1', name: 'foo', description: null, input_schema: null, display_name: null, display_description: null },
        { id: 't2', name: 'removed', description: 'old', input_schema: null, display_name: null, display_description: null },
      ],
    });

    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    discoverToolsMock.mockResolvedValue({
      ok: true,
      tools: [{ name: 'foo', description: null, inputSchema: null }],
    });

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { added: number; updated: number; stale: number };
    expect(body).toEqual({ added: 0, updated: 1, stale: 1 });
  });

  it('POST: returns 502 when origin discovery fails', async () => {
    const { stub } = makeStubSupabase({
      server: {
        id: SERVER_ID,
        origin_url: 'https://down.test/mcp',
        auth_config: null,
        organization_id: 'org-a',
      },
      existingTools: [],
    });

    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    discoverToolsMock.mockResolvedValue({
      ok: false,
      error: 'origin returned HTTP 500',
    });

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body).toEqual({
      error: 'discovery_failed',
      reason: 'origin returned HTTP 500',
    });

    expect(invalidateManifestMock).not.toHaveBeenCalled();
  });

  it('GET: returns diff preview without writing', async () => {
    const { stub, upsertCalls } = makeStubSupabase({
      server: {
        id: SERVER_ID,
        origin_url: 'https://example.test/mcp',
        auth_config: null,
        organization_id: 'org-a',
      },
      existingTools: [
        {
          id: 't1',
          name: 'foo',
          description: 'old desc',
          input_schema: null,
          display_name: null,
          display_description: null,
        },
        {
          id: 't2',
          name: 'stale_tool',
          description: 'going away',
          input_schema: null,
          display_name: null,
          display_description: null,
        },
      ],
    });

    requireAuthMock.mockResolvedValue({
      user: { id: 'u1' },
      supabase: stub,
      organization_id: 'org-a',
      role: 'admin',
    });

    discoverToolsMock.mockResolvedValue({
      ok: true,
      tools: [
        { name: 'foo', description: 'new desc', inputSchema: { type: 'object' } },
        { name: 'bar', description: 'fresh', inputSchema: null },
      ],
    });

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      toAdd: Array<{ name: string; description: string | null }>;
      toUpdate: Array<{
        name: string;
        old: { description: string | null };
        new: { description: string | null };
      }>;
      stale: Array<{ name: string; description: string | null }>;
    };

    expect(body.toAdd).toEqual([{ name: 'bar', description: 'fresh' }]);
    expect(body.toUpdate).toEqual([
      { name: 'foo', old: { description: 'old desc' }, new: { description: 'new desc' } },
    ]);
    expect(body.stale).toEqual([{ name: 'stale_tool', description: 'going away' }]);

    // GET must not write anything
    expect(upsertCalls).toHaveLength(0);
    expect(invalidateManifestMock).not.toHaveBeenCalled();
  });
});
