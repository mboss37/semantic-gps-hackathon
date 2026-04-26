import { describe, expect, it } from 'vitest';

import { importRoute } from '@/lib/routes/import';
import { RouteImportSchema } from '@/lib/schemas/route-import';

// Sprint 28 WP-28.1: pure-function tests. Mocked supabase client follows the
// same .from(t).select().eq().maybeSingle() chain pattern as
// __tests__/routes-fetch.vitest.ts. No real DB.

const ORG = 'org-import-tests';

type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: { message: string } | null };

type ClientFixture = {
  routes?: Row[];
  tools?: Row[];
  insertCapture?: { routes?: Row[]; route_steps?: Row[] };
  forceErrorOn?: { table: string; op: 'insert' | 'select' | 'delete' };
  deleteCapture?: { table: string; id: string }[];
};

const makeClient = (fixture: ClientFixture) => {
  const insertCapture = fixture.insertCapture ?? {};
  const deleteCapture = fixture.deleteCapture ?? [];

  const buildChain = (table: string) => {
    let rows: Row[] = [...(fixture[table as 'routes' | 'tools'] ?? [])];
    let lastInsert: Row[] = [];

    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => {
          if (col.includes('.')) {
            // servers.organization_id style: drill into joined relation
            const [rel, key] = col.split('.');
            const joined = (r[rel] as Row | undefined) ?? undefined;
            return joined ? joined[key] === val : true;
          }
          return r[col] === val;
        });
        return chain;
      },
      maybeSingle: async (): Promise<QueryResult> => {
        if (fixture.forceErrorOn?.table === table && fixture.forceErrorOn.op === 'select') {
          return { data: null, error: { message: 'forced lookup error' } };
        }
        return { data: rows[0] ?? null, error: null };
      },
      single: async (): Promise<QueryResult> => {
        if (fixture.forceErrorOn?.table === table && fixture.forceErrorOn.op === 'insert') {
          return { data: null, error: { message: 'forced insert error' } };
        }
        return { data: lastInsert[0] ?? rows[0] ?? null, error: null };
      },
      insert: (payload: Row | Row[]) => {
        const rowsToInsert = Array.isArray(payload) ? payload : [payload];
        if (fixture.forceErrorOn?.table === table && fixture.forceErrorOn.op === 'insert') {
          // Still record the attempt so tests can assert it happened
          lastInsert = rowsToInsert;
          (insertCapture as Record<string, Row[]>)[table] = rowsToInsert;
          return chain;
        }
        const stamped = rowsToInsert.map((r, i) => ({ id: `${table}-${i + 1}`, ...r }));
        lastInsert = stamped;
        (insertCapture as Record<string, Row[]>)[table] = stamped;
        return chain;
      },
      delete: () => ({
        eq: (_col: string, val: unknown) => {
          deleteCapture.push({ table, id: String(val) });
          return Promise.resolve({ data: null, error: null });
        },
      }),
      then: (resolve: (r: QueryResult) => void) => {
        if (
          fixture.forceErrorOn?.table === table &&
          fixture.forceErrorOn.op === 'insert' &&
          lastInsert.length > 0
        ) {
          resolve({ data: null, error: { message: 'forced insert error' } });
          return;
        }
        resolve({ data: rows, error: null });
      },
    };
    return chain;
  };

  return {
    capture: { insert: insertCapture, delete: deleteCapture },
    client: {
      from: (table: string) => buildChain(table),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
};

const sampleStep = {
  step_order: 1,
  server_name: 'Demo Salesforce',
  tool_name: 'find_account',
  input_mapping: { query: '$inputs.account_name' },
  output_capture_key: 'account',
};

const validRoute = {
  name: 'sales_escalation',
  description: 'Find an account, look up the primary contact, log a follow-up.',
  steps: [sampleStep],
};

describe('RouteImportSchema', () => {
  it('parses a minimal valid route', () => {
    const parsed = RouteImportSchema.safeParse(validRoute);
    expect(parsed.success).toBe(true);
  });

  it('rejects empty steps array', () => {
    const parsed = RouteImportSchema.safeParse({ ...validRoute, steps: [] });
    expect(parsed.success).toBe(false);
  });

  it('rejects duplicate step_order', () => {
    const parsed = RouteImportSchema.safeParse({
      ...validRoute,
      steps: [sampleStep, { ...sampleStep, step_order: 1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects half-specified rollback (server set, tool missing)', () => {
    const parsed = RouteImportSchema.safeParse({
      ...validRoute,
      steps: [{ ...sampleStep, rollback_server_name: 'Demo Salesforce' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('preserves DSL strings unchanged', () => {
    const parsed = RouteImportSchema.safeParse({
      ...validRoute,
      steps: [
        {
          ...sampleStep,
          input_mapping: {
            query: '$inputs.account_name',
            chained: '$steps.account.result.records.0.Id',
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.steps[0]?.input_mapping).toEqual({
        query: '$inputs.account_name',
        chained: '$steps.account.result.records.0.Id',
      });
    }
  });
});

describe('importRoute', () => {
  const tools = [
    {
      id: 'tool-find',
      name: 'find_account',
      servers: { name: 'Demo Salesforce', organization_id: ORG },
    },
    {
      id: 'tool-create',
      name: 'create_task',
      servers: { name: 'Demo Salesforce', organization_id: ORG },
    },
    {
      id: 'tool-delete',
      name: 'delete_task',
      servers: { name: 'Demo Salesforce', organization_id: ORG },
    },
  ];

  it('inserts a valid route + steps and returns the new id', async () => {
    const { client, capture } = makeClient({ tools });
    const parsed = RouteImportSchema.parse(validRoute);
    const result = await importRoute(client, ORG, parsed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.step_count).toBe(1);
      expect(result.route_id).toBe('routes-1');
    }
    // Step rows should map server_name+tool_name -> tool_id
    const stepRows = (capture.insert.route_steps ?? []) as Row[];
    expect(stepRows[0]?.tool_id).toBe('tool-find');
    expect(stepRows[0]?.input_mapping).toEqual({ query: '$inputs.account_name' });
  });

  it('resolves rollback_tool_name -> rollback_tool_id', async () => {
    const { client, capture } = makeClient({ tools });
    const parsed = RouteImportSchema.parse({
      ...validRoute,
      steps: [
        {
          ...sampleStep,
          step_order: 2,
          tool_name: 'create_task',
          rollback_server_name: 'Demo Salesforce',
          rollback_tool_name: 'delete_task',
          rollback_input_mapping: { task_id: '$steps.account.result.id' },
        },
      ],
    });
    const result = await importRoute(client, ORG, parsed);
    expect(result.ok).toBe(true);
    const stepRows = (capture.insert.route_steps ?? []) as Row[];
    expect(stepRows[0]?.rollback_tool_id).toBe('tool-delete');
    expect(stepRows[0]?.rollback_input_mapping).toEqual({
      task_id: '$steps.account.result.id',
    });
  });

  it('returns 409 when a route with the same name already exists', async () => {
    const { client } = makeClient({
      tools,
      routes: [{ id: 'existing-route', organization_id: ORG, name: validRoute.name }],
    });
    const parsed = RouteImportSchema.parse(validRoute);
    const result = await importRoute(client, ORG, parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe('duplicate');
    }
  });

  it('returns 400 when the primary tool is unknown', async () => {
    const { client } = makeClient({ tools });
    const parsed = RouteImportSchema.parse({
      ...validRoute,
      steps: [{ ...sampleStep, tool_name: 'nonexistent_tool' }],
    });
    const result = await importRoute(client, ORG, parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('tool not found');
      expect(result.details).toContain('nonexistent_tool');
    }
  });

  it('returns 400 when the rollback tool is unknown', async () => {
    const { client } = makeClient({ tools });
    const parsed = RouteImportSchema.parse({
      ...validRoute,
      steps: [
        {
          ...sampleStep,
          rollback_server_name: 'Demo Salesforce',
          rollback_tool_name: 'unknown_compensator',
        },
      ],
    });
    const result = await importRoute(client, ORG, parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.details).toContain('unknown_compensator');
    }
  });

  it('manually rolls back the route insert when steps insert fails', async () => {
    const { client, capture } = makeClient({
      tools,
      forceErrorOn: { table: 'route_steps', op: 'insert' },
    });
    const parsed = RouteImportSchema.parse(validRoute);
    const result = await importRoute(client, ORG, parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe('route_steps insert failed');
    }
    expect(capture.delete).toContainEqual({ table: 'routes', id: 'routes-1' });
  });

  it('does not leak tool indexes across orgs (RLS-equivalent at app layer)', async () => {
    const { client } = makeClient({
      tools: [
        {
          id: 'other-tool',
          name: 'find_account',
          servers: { name: 'Demo Salesforce', organization_id: 'OTHER_ORG' },
        },
      ],
    });
    const parsed = RouteImportSchema.parse(validRoute);
    const result = await importRoute(client, ORG, parsed);
    // The eq filter on servers.organization_id excludes the other-org tool;
    // so the lookup fails with a 400, not a successful import using cross-org id.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});
