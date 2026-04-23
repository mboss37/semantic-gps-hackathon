import { describe, expect, it } from 'vitest';
import { fetchOrgRoutes, fetchRouteDetail } from '@/lib/routes/fetch';

const uuid = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const ORG_A = uuid(1);
const ORG_B = uuid(2);
const ROUTE_A1 = uuid(10);
const ROUTE_A2 = uuid(11);
const ROUTE_B = uuid(12);
const TOOL_1 = uuid(20);
const TOOL_2 = uuid(21);
const ROLLBACK_TOOL = uuid(22);
const STEP_1 = uuid(30);
const STEP_2 = uuid(31);

type QueryResult = { data: unknown; error: null };

type MockTables = {
  routes: Array<Record<string, unknown>>;
  route_steps: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
};

// Minimal Supabase client stub. Returns the configured fixture for each
// .from(table).select().<filter>... chain. We only implement the subset the
// fetch helpers use: eq, in, order, maybeSingle.
const makeClient = (tables: MockTables) => {
  const buildChain = (table: keyof MockTables) => {
    let rows: Array<Record<string, unknown>> = [...tables[table]];
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === val);
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

const baseTables = (): MockTables => ({
  routes: [
    { id: ROUTE_A1, organization_id: ORG_A, domain_id: null, name: 'alpha', description: 'first' },
    { id: ROUTE_A2, organization_id: ORG_A, domain_id: null, name: 'beta', description: null },
    { id: ROUTE_B, organization_id: ORG_B, domain_id: null, name: 'other-org', description: null },
  ],
  route_steps: [
    {
      id: STEP_2,
      route_id: ROUTE_A1,
      step_order: 2,
      tool_id: TOOL_2,
      input_mapping: { foo: '$inputs.bar' },
      rollback_input_mapping: { foo: '$steps.s1.result.id' },
      output_capture_key: 's2',
      fallback_route_id: ROUTE_A2,
      rollback_tool_id: ROLLBACK_TOOL,
    },
    {
      id: STEP_1,
      route_id: ROUTE_A1,
      step_order: 1,
      tool_id: TOOL_1,
      input_mapping: {},
      rollback_input_mapping: null,
      output_capture_key: 's1',
      fallback_route_id: null,
      rollback_tool_id: null,
    },
  ],
  tools: [
    { id: TOOL_1, name: 'find_account', display_name: 'Find Account' },
    { id: TOOL_2, name: 'create_task', display_name: null },
    { id: ROLLBACK_TOOL, name: 'delete_task', display_name: null },
  ],
});

describe('fetchOrgRoutes', () => {
  it('returns only caller-org routes with step counts', async () => {
    const client = makeClient(baseTables());
    const result = await fetchOrgRoutes(client, ORG_A);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['alpha', 'beta']);
    const alpha = result.find((r) => r.name === 'alpha');
    expect(alpha?.step_count).toBe(2);
    expect(result.find((r) => r.name === 'beta')?.step_count).toBe(0);
  });
});

describe('fetchRouteDetail', () => {
  it('returns steps sorted by step_order ascending', async () => {
    const client = makeClient(baseTables());
    const detail = await fetchRouteDetail(client, ORG_A, ROUTE_A1);
    expect(detail).not.toBeNull();
    expect(detail?.steps.map((s) => s.step_order)).toEqual([1, 2]);
  });

  it('resolves tool / fallback route / rollback tool names', async () => {
    const client = makeClient(baseTables());
    const detail = await fetchRouteDetail(client, ORG_A, ROUTE_A1);
    const step2 = detail?.steps.find((s) => s.step_order === 2);
    expect(step2?.tool_name).toBe('create_task');
    expect(step2?.fallback_route_name).toBe('beta');
    expect(step2?.rollback_tool_name).toBe('delete_task');
    const step1 = detail?.steps.find((s) => s.step_order === 1);
    expect(step1?.tool_name).toBe('find_account');
    expect(step1?.fallback_route_name).toBeNull();
    expect(step1?.rollback_tool_name).toBeNull();
  });

  it('returns null for unknown route id', async () => {
    const client = makeClient(baseTables());
    const detail = await fetchRouteDetail(client, ORG_A, uuid(999));
    expect(detail).toBeNull();
  });

  it('returns null when route belongs to a different org (no cross-org leak)', async () => {
    const client = makeClient(baseTables());
    const detail = await fetchRouteDetail(client, ORG_A, ROUTE_B);
    expect(detail).toBeNull();
  });
});
