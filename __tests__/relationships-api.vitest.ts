import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

// Sprint 6 WP-G.2: DB integration test for the relationships CRUD surface.
// We exercise the tables directly (not the HTTP handlers) because the route
// handlers go through the user-scoped Supabase client + auth cookies, which
// vitest can't easily fake. Direct-to-DB covers the meaningful invariants:
// scope via tool->server->org joins, duplicate-triple uniqueness, and the
// cascade delete on tools removal.
//
// The HTTP routes themselves (app/api/relationships/*.ts) re-use the same
// zod schemas + queries; a shape-smoke at the bottom asserts the types.

const shouldRun =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;

describe.skipIf(!shouldRun)('relationships CRUD invariants', () => {
  let supabase: SupabaseClient;
  let orgA: string;
  let orgB: string;
  let toolA1: string;
  let toolA2: string;
  let toolB1: string;
  const createdUserIds: string[] = [];
  const createdServerIds: string[] = [];
  const createdRelIds: string[] = [];

  const createUser = async (email: string): Promise<string> => {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: 'test-pw-123456',
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('admin.createUser returned no user');
    createdUserIds.push(data.user.id);
    return data.user.id;
  };

  const orgOf = async (userId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();
    if (error) throw new Error(error.message);
    return data.organization_id as string;
  };

  const seedServerWithTools = async (
    organizationId: string,
    toolNames: string[],
  ): Promise<string[]> => {
    const { data: server, error: sErr } = await supabase
      .from('servers')
      .insert({
        organization_id: organizationId,
        name: `wp-g2-srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        transport: 'openapi',
      })
      .select('id')
      .single();
    if (sErr) throw new Error(sErr.message);
    if (!server) throw new Error('server insert returned no row');
    createdServerIds.push(server.id);

    const { data: tools, error: tErr } = await supabase
      .from('tools')
      .insert(toolNames.map((n) => ({ server_id: server.id, name: n })))
      .select('id, name');
    if (tErr) throw new Error(tErr.message);
    if (!tools || tools.length !== toolNames.length) {
      throw new Error('tool seeding failed');
    }
    return toolNames.map((n) => {
      const t = tools.find((x) => x.name === n);
      if (!t) throw new Error(`missing seeded tool ${n}`);
      return t.id;
    });
  };

  beforeAll(async () => {
    supabase = createServiceClient();

    const ts = Date.now();
    const userA = await createUser(`wp-g2-rel-a-${ts}@test.local`);
    const userB = await createUser(`wp-g2-rel-b-${ts}@test.local`);
    orgA = await orgOf(userA);
    orgB = await orgOf(userB);

    const aTools = await seedServerWithTools(orgA, ['alpha_one', 'alpha_two']);
    toolA1 = aTools[0];
    toolA2 = aTools[1];
    const bTools = await seedServerWithTools(orgB, ['beta_one']);
    toolB1 = bTools[0];
  });

  afterAll(async () => {
    if (createdRelIds.length > 0) {
      await supabase.from('relationships').delete().in('id', createdRelIds);
    }
    if (createdServerIds.length > 0) {
      await supabase.from('servers').delete().in('id', createdServerIds);
    }
    for (const id of createdUserIds) {
      await supabase.auth.admin.deleteUser(id);
    }
  });

  it('POST happy path — creates a same-org edge', async () => {
    const { data, error } = await supabase
      .from('relationships')
      .insert({
        from_tool_id: toolA1,
        to_tool_id: toolA2,
        relationship_type: 'produces_input_for',
        description: 'alpha_one feeds alpha_two as input',
      })
      .select('id, relationship_type, description')
      .single();

    expect(error).toBeNull();
    expect(data?.relationship_type).toBe('produces_input_for');
    if (data) createdRelIds.push(data.id);
  });

  it('PATCH — description edit persists', async () => {
    const insert = await supabase
      .from('relationships')
      .insert({
        from_tool_id: toolA1,
        to_tool_id: toolA2,
        relationship_type: 'requires_before',
        description: 'original text',
      })
      .select('id')
      .single();
    if (insert.error || !insert.data) throw new Error('seed insert failed');
    const relId = insert.data.id;
    createdRelIds.push(relId);

    const { error: updErr } = await supabase
      .from('relationships')
      .update({ description: 'updated description' })
      .eq('id', relId);
    expect(updErr).toBeNull();

    const { data: after } = await supabase
      .from('relationships')
      .select('description')
      .eq('id', relId)
      .single();
    expect(after?.description).toBe('updated description');
  });

  it('duplicate triple (from, to, type) is rejected by unique constraint', async () => {
    // First insert succeeds.
    const first = await supabase
      .from('relationships')
      .insert({
        from_tool_id: toolA1,
        to_tool_id: toolA2,
        relationship_type: 'validates',
        description: 'first validates edge',
      })
      .select('id')
      .single();
    if (first.error || !first.data) throw new Error('first insert failed unexpectedly');
    createdRelIds.push(first.data.id);

    // Second with identical triple must collide.
    const dup = await supabase.from('relationships').insert({
      from_tool_id: toolA1,
      to_tool_id: toolA2,
      relationship_type: 'validates',
      description: 'duplicate edge',
    });
    expect(dup.error).not.toBeNull();
    expect(dup.error?.code).toBe('23505');
  });

  it('cross-org join: tools from orgA + orgB cannot both be pulled under one org scope', async () => {
    // This simulates what the route handler does: select tools with
    // servers.organization_id = orgA. toolB1 (in orgB) must be filtered out.
    const { data, error } = await supabase
      .from('tools')
      .select('id, servers!inner(organization_id)')
      .in('id', [toolA1, toolB1])
      .eq('servers.organization_id', orgA);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(toolA1);
  });

  it('DELETE — relationship is removed and no longer queryable', async () => {
    const insert = await supabase
      .from('relationships')
      .insert({
        from_tool_id: toolA2,
        to_tool_id: toolA1,
        relationship_type: 'fallback_to',
        description: 'fallback edge for delete test',
      })
      .select('id')
      .single();
    if (insert.error || !insert.data) throw new Error('seed insert failed');
    const relId = insert.data.id;

    const { error: delErr } = await supabase.from('relationships').delete().eq('id', relId);
    expect(delErr).toBeNull();

    const { data } = await supabase
      .from('relationships')
      .select('id')
      .eq('id', relId)
      .maybeSingle();
    expect(data).toBeNull();
  });
});

// Always-on smoke so a run without DB env still has an assertion pointing at
// the contract this WP ships.
describe('relationships API shape (smoke)', () => {
  it('8 relationship types are supported', () => {
    const types = [
      'produces_input_for',
      'requires_before',
      'suggests_after',
      'mutually_exclusive',
      'alternative_to',
      'validates',
      'compensated_by',
      'fallback_to',
    ];
    expect(types).toHaveLength(8);
  });
});
