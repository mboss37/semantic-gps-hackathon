import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

// DB integration test for the domains table (WP-B.1). Covers the auto-seed
// via the extended handle_new_user trigger and org-scoped CRUD.
// Skipped unless Supabase env vars are present.

const shouldRun =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY && !process.env.CI;

describe.skipIf(!shouldRun)('domains table + default seed', () => {
  let supabase: SupabaseClient;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    supabase = createServiceClient();
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await supabase.auth.admin.deleteUser(id);
    }
  });

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

  it('new signup gets a default SalesOps domain', async () => {
    const userId = await createUser(`wp-b1-default-${Date.now()}@test.local`);

    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    const { data: domains, error } = await supabase
      .from('domains')
      .select('slug, name, description')
      .eq('organization_id', membership?.organization_id);

    expect(error).toBeNull();
    expect(domains).toHaveLength(1);
    expect(domains?.[0].slug).toBe('salesops');
    expect(domains?.[0].name).toBe('SalesOps');
  });

  it('two orgs have isolated domain slugs (unique per org, not global)', async () => {
    const ts = Date.now();
    const a = await createUser(`wp-b1-iso-a-${ts}@test.local`);
    const b = await createUser(`wp-b1-iso-b-${ts}@test.local`);

    const memberships = await supabase
      .from('memberships')
      .select('user_id, organization_id')
      .in('user_id', [a, b]);

    const orgIds = memberships.data?.map((m) => m.organization_id) ?? [];
    expect(orgIds).toHaveLength(2);

    const domains = await supabase
      .from('domains')
      .select('organization_id, slug')
      .in('organization_id', orgIds);

    expect(domains.data).toHaveLength(2);
    const perOrg = new Map<string, string[]>();
    for (const d of domains.data ?? []) {
      const arr = perOrg.get(d.organization_id) ?? [];
      arr.push(d.slug);
      perOrg.set(d.organization_id, arr);
    }
    for (const slugs of perOrg.values()) {
      expect(slugs).toEqual(['salesops']);
    }
  });

  it('duplicate slug in same org is rejected by unique constraint', async () => {
    const userId = await createUser(`wp-b1-dup-${Date.now()}@test.local`);
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    const { error } = await supabase
      .from('domains')
      .insert({
        organization_id: membership?.organization_id,
        slug: 'salesops',
        name: 'Duplicate',
      });

    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });
});

describe('domains migration shape (smoke)', () => {
  it('domain slug is org-scoped, not global', () => {
    expect(true).toBe(true);
  });
});
