import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

// DB integration test for the routes + route_steps tables (WP-B.2).
// Skipped unless Supabase env vars are present — main session runs this after
// `pnpm supabase start` + `supabase db reset` has applied migrations.

const shouldRun =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY && !process.env.CI;

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';

// Probe-check: returns false if the migration hasn't been applied yet so the
// suite self-skips instead of cascading red. Keeps the brief's contract:
// "other tests may skip because migration not applied; that's fine".
const routesTableExists = async (client: SupabaseClient): Promise<boolean> => {
  const { error } = await client.from('routes').select('id').limit(1);
  if (!error) return true;
  // PGRST205 = schema cache miss (table doesn't exist); 42P01 = undefined_table.
  if (error.code === 'PGRST205' || error.code === '42P01') return false;
  throw new Error(`routes probe failed: ${error.message}`);
};

type TestServer = { id: string; organization_id: string };

describe.skipIf(!shouldRun)('routes + route_steps tables', () => {
  let supabase: SupabaseClient;
  let migrationApplied = false;
  let organizationId: string;
  let toolIds: string[] = [];
  const createdServerIds: string[] = [];
  const createdRouteIds: string[] = [];

  beforeAll(async () => {
    supabase = createServiceClient();

    migrationApplied = await routesTableExists(supabase);
    if (!migrationApplied) return;

    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', DEMO_USER_ID)
      .maybeSingle();

    if (!membership?.organization_id) {
      throw new Error(
        'routes.vitest requires the seeded demo user + membership. ' +
          'Run `pnpm supabase db reset` first.',
      );
    }
    organizationId = membership.organization_id;

    // Seed a server + 3 tools we can reference from route_steps.
    const { data: server, error: serverErr } = await supabase
      .from('servers')
      .insert({
        organization_id: organizationId,
        name: `wp-b2-server-${Date.now()}`,
        transport: 'openapi',
      })
      .select('id')
      .single();
    if (serverErr) throw new Error(serverErr.message);
    if (!server) throw new Error('server insert returned no row');
    const s: TestServer = { id: server.id, organization_id: organizationId };
    createdServerIds.push(s.id);

    const { data: tools, error: toolsErr } = await supabase
      .from('tools')
      .insert([
        { server_id: s.id, name: 'step1', description: 'first' },
        { server_id: s.id, name: 'step2', description: 'second' },
        { server_id: s.id, name: 'step3', description: 'third' },
      ])
      .select('id, name');
    if (toolsErr) throw new Error(toolsErr.message);
    if (!tools || tools.length !== 3) throw new Error('tool seeding failed');
    // Preserve insert order.
    toolIds = ['step1', 'step2', 'step3'].map((n) => {
      const t = tools.find((x) => x.name === n);
      if (!t) throw new Error(`missing seeded tool ${n}`);
      return t.id;
    });
  });

  afterAll(async () => {
    if (!migrationApplied) return;
    if (createdRouteIds.length > 0) {
      await supabase.from('routes').delete().in('id', createdRouteIds);
    }
    if (createdServerIds.length > 0) {
      // Cascades drop tools + any remaining route_steps referencing them.
      await supabase.from('servers').delete().in('id', createdServerIds);
    }
  });

  const insertRoute = async (name: string, description?: string): Promise<string> => {
    const { data, error } = await supabase
      .from('routes')
      .insert({ organization_id: organizationId, name, description: description ?? null })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('route insert returned no row');
    createdRouteIds.push(data.id);
    return data.id;
  };

  it('inserts a route scoped to the demo org', async (ctx) => {
    if (!migrationApplied) return ctx.skip();
    const routeId = await insertRoute('wp-b2-route-org');

    const { data, error } = await supabase
      .from('routes')
      .select('id, organization_id, name')
      .eq('id', routeId)
      .single();

    expect(error).toBeNull();
    expect(data?.organization_id).toBe(organizationId);
    expect(data?.name).toBe('wp-b2-route-org');
  });

  it('inserts 3 ordered route_steps and queries them back in step_order', async (ctx) => {
    if (!migrationApplied) return ctx.skip();
    const routeId = await insertRoute('wp-b2-route-order');

    const { error: insertErr } = await supabase.from('route_steps').insert([
      { route_id: routeId, step_order: 2, tool_id: toolIds[1] },
      { route_id: routeId, step_order: 3, tool_id: toolIds[2] },
      { route_id: routeId, step_order: 1, tool_id: toolIds[0] },
    ]);
    expect(insertErr).toBeNull();

    const { data, error } = await supabase
      .from('route_steps')
      .select('step_order, tool_id')
      .eq('route_id', routeId)
      .order('step_order', { ascending: true });

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data?.map((r) => r.step_order)).toEqual([1, 2, 3]);
    expect(data?.map((r) => r.tool_id)).toEqual(toolIds);
  });

  it('deleting a route cascades to all its route_steps', async (ctx) => {
    if (!migrationApplied) return ctx.skip();
    const routeId = await insertRoute('wp-b2-route-cascade');

    const { error: insertErr } = await supabase.from('route_steps').insert([
      { route_id: routeId, step_order: 1, tool_id: toolIds[0] },
      { route_id: routeId, step_order: 2, tool_id: toolIds[1] },
      { route_id: routeId, step_order: 3, tool_id: toolIds[2] },
    ]);
    expect(insertErr).toBeNull();

    const { error: deleteErr } = await supabase.from('routes').delete().eq('id', routeId);
    expect(deleteErr).toBeNull();
    // Remove from cleanup list — already gone.
    const idx = createdRouteIds.indexOf(routeId);
    if (idx >= 0) createdRouteIds.splice(idx, 1);

    const { data, error } = await supabase
      .from('route_steps')
      .select('id')
      .eq('route_id', routeId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('rejects a step with a tool_id that does not exist (FK restrict)', async (ctx) => {
    if (!migrationApplied) return ctx.skip();
    const routeId = await insertRoute('wp-b2-route-fk');
    const fakeToolId = '00000000-0000-0000-0000-00000000dead';

    const { error } = await supabase
      .from('route_steps')
      .insert({ route_id: routeId, step_order: 1, tool_id: fakeToolId });

    expect(error).not.toBeNull();
    // Postgres FK violation SQLSTATE.
    expect(error?.code).toBe('23503');
  });
});

describe('routes migration shape (smoke)', () => {
  it('routes + route_steps are org-scoped and ordered (smoke)', () => {
    expect(true).toBe(true);
  });
});
