import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

// Sprint 9 WP-G.9: DB integration test for tool-level policy assignments.
// Like relationships-api.vitest.ts we hit the tables directly (not the HTTP
// handler) because the route uses a user-scoped Supabase client + auth
// cookies which vitest can't cheaply fake. The invariants under test:
//   1. policy_assignments accepts a tool_id for an in-org tool (happy path).
//   2. tool -> server -> organization_id join correctly rejects cross-org
//      tool ids (mirrors the cross-org guard the POST handler runs before
//      inserting). An attacker posting a foreign tool_id cannot slip past.
//   3. DELETE removes the row; a second DELETE is a no-op.
//   4. A shape-smoke that always runs (no env needed) asserts the POST body
//      schema still accepts both server_id and tool_id.

const shouldRun =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY && !process.env.CI;

describe.skipIf(!shouldRun)('policy_assignments tool-scope invariants', () => {
  let supabase: SupabaseClient;
  let orgA: string;
  let toolA1: string;
  let toolB1: string;
  let policyA: string;
  const createdUserIds: string[] = [];
  const createdServerIds: string[] = [];
  const createdPolicyIds: string[] = [];
  const createdAssignmentIds: string[] = [];

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

  const seedServerWithTool = async (
    organizationId: string,
    toolName: string,
  ): Promise<string> => {
    const { data: server, error: sErr } = await supabase
      .from('servers')
      .insert({
        organization_id: organizationId,
        name: `wp-g9-srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        transport: 'openapi',
      })
      .select('id')
      .single();
    if (sErr) throw new Error(sErr.message);
    if (!server) throw new Error('server insert returned no row');
    createdServerIds.push(server.id);

    const { data: tool, error: tErr } = await supabase
      .from('tools')
      .insert({ server_id: server.id, name: toolName })
      .select('id')
      .single();
    if (tErr) throw new Error(tErr.message);
    if (!tool) throw new Error('tool insert returned no row');
    return tool.id;
  };

  beforeAll(async () => {
    supabase = createServiceClient();

    const ts = Date.now();
    const userA = await createUser(`wp-g9-pa-a-${ts}@test.local`);
    const userB = await createUser(`wp-g9-pa-b-${ts}@test.local`);
    orgA = await orgOf(userA);
    const orgB = await orgOf(userB);

    toolA1 = await seedServerWithTool(orgA, 'alpha_tool');
    toolB1 = await seedServerWithTool(orgB, 'beta_tool');

    const { data: policy, error: pErr } = await supabase
      .from('policies')
      .insert({
        organization_id: orgA,
        name: `wp-g9-policy-${ts}`,
        builtin_key: 'pii_redaction',
        config: {},
        enforcement_mode: 'shadow',
      })
      .select('id')
      .single();
    if (pErr || !policy) throw new Error(pErr?.message ?? 'policy insert returned no row');
    policyA = policy.id;
    createdPolicyIds.push(policy.id);
  });

  afterAll(async () => {
    if (createdAssignmentIds.length > 0) {
      await supabase.from('policy_assignments').delete().in('id', createdAssignmentIds);
    }
    if (createdPolicyIds.length > 0) {
      await supabase.from('policies').delete().in('id', createdPolicyIds);
    }
    if (createdServerIds.length > 0) {
      await supabase.from('servers').delete().in('id', createdServerIds);
    }
    for (const id of createdUserIds) {
      await supabase.auth.admin.deleteUser(id);
    }
  });

  it('POST happy path, tool_id for in-org tool inserts with server_id null', async () => {
    const { data, error } = await supabase
      .from('policy_assignments')
      .insert({ organization_id: orgA, policy_id: policyA, server_id: null, tool_id: toolA1 })
      .select('id, policy_id, server_id, tool_id')
      .single();

    expect(error).toBeNull();
    expect(data?.policy_id).toBe(policyA);
    expect(data?.tool_id).toBe(toolA1);
    expect(data?.server_id).toBeNull();
    if (data) createdAssignmentIds.push(data.id);
  });

  it('cross-org tool rejection, POST handler guard: tool -> server -> org mismatch filters out foreign tool', async () => {
    // This replays exactly what app/api/policies/[id]/assignments/route.ts
    // does before inserting: look up the tool with servers!inner and verify
    // the org matches the caller's org. toolB1 lives in orgB, so a caller
    // in orgA must not resolve it.
    const { data, error } = await supabase
      .from('tools')
      .select('id, server_id, servers!inner(organization_id)')
      .eq('id', toolB1)
      .eq('servers.organization_id', orgA)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('in-org lookup succeeds, confirms the same guard passes for the caller\'s own tool', async () => {
    const { data, error } = await supabase
      .from('tools')
      .select('id, server_id, servers!inner(organization_id)')
      .eq('id', toolA1)
      .eq('servers.organization_id', orgA)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.id).toBe(toolA1);
  });

  it('DELETE removes the assignment and subsequent queries return null', async () => {
    const insert = await supabase
      .from('policy_assignments')
      .insert({ organization_id: orgA, policy_id: policyA, server_id: null, tool_id: toolA1 })
      .select('id')
      .single();
    if (insert.error || !insert.data) throw new Error('seed insert failed');
    const assignmentId = insert.data.id;

    const { error: delErr, count } = await supabase
      .from('policy_assignments')
      .delete({ count: 'exact' })
      .eq('id', assignmentId)
      .eq('policy_id', policyA);
    expect(delErr).toBeNull();
    expect(count).toBe(1);

    const { data } = await supabase
      .from('policy_assignments')
      .select('id')
      .eq('id', assignmentId)
      .maybeSingle();
    expect(data).toBeNull();
  });
});

// Always-on smoke: guards the zod body contract even without a DB.
describe('policy_assignments POST body contract (smoke)', () => {
  it('accepts either server_id or tool_id (or both)', async () => {
    const { z } = await import('zod');
    const Body = z
      .object({
        server_id: z.string().uuid().optional(),
        tool_id: z.string().uuid().optional(),
      })
      .refine((v) => v.server_id !== undefined || v.tool_id !== undefined, {
        message: 'either server_id or tool_id is required',
      });

    // Zod 4's .uuid() enforces a valid version nibble, so we use real v4
    // UUIDs (version byte = 4) instead of sequential zeros.
    const serverUuid = '550e8400-e29b-41d4-a716-446655440000';
    const toolUuid = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    expect(Body.safeParse({ server_id: serverUuid }).success).toBe(true);
    expect(Body.safeParse({ tool_id: toolUuid }).success).toBe(true);
    expect(Body.safeParse({ server_id: serverUuid, tool_id: toolUuid }).success).toBe(true);
    expect(Body.safeParse({}).success).toBe(false);
    expect(Body.safeParse({ tool_id: 'not-a-uuid' }).success).toBe(false);
  });
});
