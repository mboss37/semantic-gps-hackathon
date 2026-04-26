import { describe, expect, it } from 'vitest';
import { fetchServerDetail, fetchRemoteCapabilities } from '@/lib/servers/fetch';

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ORG_A = uuid(1);
const ORG_B = uuid(2);
const SERVER_A = uuid(10);
const SERVER_B = uuid(11);
const SERVER_EMPTY = uuid(12);
const TOOL_1 = uuid(20);
const TOOL_2 = uuid(21);

type QueryResult = { data: unknown; error: null };

type MockTables = {
  servers: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  mcp_events: Array<Record<string, unknown>>;
};

// Minimal Supabase chain stub. Implements just the subset `fetchServerDetail`
// calls: select / eq / gte / order / maybeSingle / thenable. Mirrors the
// pattern from __tests__/routes-fetch.vitest.ts.
const makeClient = (tables: MockTables) => {
  const buildChain = (table: keyof MockTables) => {
    let rows: Array<Record<string, unknown>> = [...tables[table]];
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === val);
        return chain;
      },
      gte: (col: string, val: unknown) => {
        rows = rows.filter((r) => {
          const v = r[col];
          if (typeof v === 'string' && typeof val === 'string') return v >= val;
          if (typeof v === 'number' && typeof val === 'number') return v >= val;
          return true;
        });
        return chain;
      },
      in: (col: string, vals: unknown[]) => {
        const set = new Set(vals);
        rows = rows.filter((r) => set.has(r[col]));
        return chain;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending !== false;
        rows = [...rows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av as number | string) < (bv as number | string) ? (asc ? -1 : 1) : asc ? 1 : -1;
        });
        return chain;
      },
      maybeSingle: async (): Promise<QueryResult> => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (r: QueryResult) => void) => {
        resolve({ data: rows, error: null });
      },
    };
    return chain;
  };
  return {
    from: (table: string) => buildChain(table as keyof MockTables),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
};

const nowIso = new Date().toISOString();

const baseTables = (): MockTables => ({
  servers: [
    {
      id: SERVER_A,
      organization_id: ORG_A,
      name: 'Salesforce',
      origin_url: 'http://localhost:3000/api/mcps/salesforce',
      transport: 'http-streamable',
      auth_config: { type: 'bearer', token: 'fake' },
      created_at: nowIso,
    },
    {
      id: SERVER_B,
      organization_id: ORG_B,
      name: 'Other-Org Server',
      origin_url: null,
      transport: 'openapi',
      auth_config: null,
      created_at: nowIso,
    },
    {
      id: SERVER_EMPTY,
      organization_id: ORG_A,
      name: 'Fresh',
      origin_url: null,
      transport: 'openapi',
      auth_config: null,
      created_at: nowIso,
    },
  ],
  tools: [
    {
      id: TOOL_1,
      server_id: SERVER_A,
      name: 'find_account',
      description: 'lookup',
      display_name: 'Find Account',
      display_description: null,
    },
    {
      id: TOOL_2,
      server_id: SERVER_A,
      name: 'create_task',
      description: null,
      display_name: null,
      display_description: null,
    },
  ],
  mcp_events: [],
});

describe('fetchServerDetail', () => {
  it('returns server detail with tools and zero violations for a clean org', async () => {
    const client = makeClient(baseTables());
    const detail = await fetchServerDetail(client, ORG_A, SERVER_A);
    expect(detail).not.toBeNull();
    expect(detail?.server.name).toBe('Salesforce');
    expect(detail?.server.has_auth).toBe(true);
    // Never leak auth_config through.
    expect((detail?.server as Record<string, unknown>).auth_config).toBeUndefined();
    expect(detail?.tools.map((t) => t.name).sort()).toEqual(['create_task', 'find_account']);
    expect(detail?.violationsByPolicy).toEqual([]);
  });

  it('aggregates violations by policy_name from policy_decisions array', async () => {
    const tables = baseTables();
    // Three blocked events against the server, two policies involved, one
    // policy appears twice, one "allow" decision is ignored.
    tables.mcp_events = [
      {
        server_id: SERVER_A,
        created_at: nowIso,
        status: 'blocked_by_policy',
        policy_decisions: [
          { policy_name: 'pii_redaction', decision: 'block', mode: 'enforce' },
          { policy_name: 'rate_limit', decision: 'allow', mode: 'shadow' },
        ],
      },
      {
        server_id: SERVER_A,
        created_at: nowIso,
        status: 'blocked_by_policy',
        policy_decisions: [{ policy_name: 'pii_redaction', decision: 'block', mode: 'enforce' }],
      },
      {
        server_id: SERVER_A,
        created_at: nowIso,
        status: 'blocked_by_policy',
        policy_decisions: [{ policy_name: 'rate_limit', decision: 'block', mode: 'enforce' }],
      },
    ];
    const client = makeClient(tables);
    const detail = await fetchServerDetail(client, ORG_A, SERVER_A);
    expect(detail).not.toBeNull();
    const byPolicy = Object.fromEntries(
      (detail?.violationsByPolicy ?? []).map((v) => [v.policy_name, v.count]),
    );
    expect(byPolicy).toEqual({ pii_redaction: 2, rate_limit: 1 });
    // Order: highest count first.
    expect(detail?.violationsByPolicy[0]?.policy_name).toBe('pii_redaction');
  });

  it('returns null when the server belongs to a different org (no cross-org leak)', async () => {
    const client = makeClient(baseTables());
    const detail = await fetchServerDetail(client, ORG_A, SERVER_B);
    expect(detail).toBeNull();
  });
});

describe('fetchRemoteCapabilities', () => {
  it('returns null capabilities without network for openapi transport', async () => {
    // Spy on fetch by monkey-patching, any call during this test fails it.
    const original = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error('fetch must not be called for openapi transport');
    }) as typeof fetch;
    try {
      const caps = await fetchRemoteCapabilities({
        transport: 'openapi',
        origin_url: 'https://example.test/openapi.json',
        auth_config: null,
      });
      expect(caps).toEqual({ resources: null, prompts: null, error: null });
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });
});
