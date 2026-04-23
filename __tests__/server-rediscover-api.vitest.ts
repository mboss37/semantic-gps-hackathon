import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Sprint 14 WP-14.3: /api/servers/[id]/rediscover. Exercises the diff-and-
// upsert path against a chain-stub Supabase, with discoverTools mocked.
// Asserts: new tools inserted, existing-name updates preserve display_name,
// 502 on origin unreachable.

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
  display_name: string | null;
  display_description: string | null;
};

type InsertCall = {
  table: string;
  rows: Array<Record<string, unknown>>;
};

type UpdateCall = {
  table: string;
  values: Record<string, unknown>;
  whereId: string;
};

type StubOptions = {
  server: { id: string; origin_url: string | null; auth_config: unknown; organization_id: string } | null;
  existingTools: ExistingToolRow[];
};

const makeStubSupabase = (opts: StubOptions) => {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];

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
          insert: (rows: Array<Record<string, unknown>>) => {
            insertCalls.push({ table, rows });
            return Promise.resolve({ error: null });
          },
          update: (values: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ table, values, whereId: id });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  return { stub, insertCalls, updateCalls };
};

const { POST } = await import('@/app/api/servers/[id]/rediscover/route');

const makeRequest = () =>
  new Request(`http://localhost/api/servers/${SERVER_ID}/rediscover`, { method: 'POST' });

describe('server rediscover API (Sprint 14.3)', () => {
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

  it('inserts new tool, updates existing by name, reports counts', async () => {
    const { stub, insertCalls, updateCalls } = makeStubSupabase({
      server: {
        id: SERVER_ID,
        origin_url: 'https://example.test/mcp',
        auth_config: null,
        organization_id: 'org-a',
      },
      existingTools: [
        { id: 't1', name: 'foo', display_name: 'Foo Custom', display_description: 'desc' },
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

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { added: number; updated: number; stale: number };
    expect(body).toEqual({ added: 1, updated: 1, stale: 0 });

    expect(invalidateManifestMock).toHaveBeenCalledOnce();

    // Exactly one insert with the new tool only.
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].rows).toEqual([
      {
        server_id: SERVER_ID,
        name: 'bar',
        description: 'fresh tool',
        input_schema: { type: 'object' },
      },
    ]);

    // Exactly one update for 'foo' — preserves display_* by NOT including them.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].whereId).toBe('t1');
    expect(updateCalls[0].values).toEqual({
      description: 'new desc',
      input_schema: { type: 'object' },
    });
    expect(updateCalls[0].values).not.toHaveProperty('display_name');
    expect(updateCalls[0].values).not.toHaveProperty('display_description');
  });

  it('counts stale tools (existing name not in discovery)', async () => {
    const { stub } = makeStubSupabase({
      server: {
        id: SERVER_ID,
        origin_url: 'https://example.test/mcp',
        auth_config: null,
        organization_id: 'org-a',
      },
      existingTools: [
        { id: 't1', name: 'foo', display_name: null, display_description: null },
        { id: 't2', name: 'removed', display_name: null, display_description: null },
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

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { added: number; updated: number; stale: number };
    expect(body).toEqual({ added: 0, updated: 1, stale: 1 });
  });

  it('returns 502 when origin discovery fails', async () => {
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

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: SERVER_ID }) });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body).toEqual({
      error: 'discovery_failed',
      reason: 'origin returned HTTP 500',
    });

    expect(invalidateManifestMock).not.toHaveBeenCalled();
  });
});
