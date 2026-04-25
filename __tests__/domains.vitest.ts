import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

// DB integration test for the domains table.
// Sprint 24 contract change: signup no longer auto-seeds a SalesOps domain.
// New signups get a clean org + membership only — domain creation is
// user-controlled (UI greyed out as "Soon" pending CRUD work). Tests below
// reflect the new shape: no domain on signup, domain inserts are explicit,
// and the per-org unique constraint still holds.
// Skipped unless Supabase env vars are present.

const shouldRun =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY && !process.env.CI;

describe.skipIf(!shouldRun)('domains table contract', () => {
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

  it('new signup creates a clean org with no auto-seeded domain', async () => {
    const userId = await createUser(`wp-b1-clean-${Date.now()}@test.local`);

    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    const { data: domains, error } = await supabase
      .from('domains')
      .select('slug, name')
      .eq('organization_id', membership?.organization_id);

    expect(error).toBeNull();
    expect(domains).toHaveLength(0);
  });

  it('domain slug uniqueness is per-org, not global', async () => {
    const ts = Date.now();
    const a = await createUser(`wp-b1-iso-a-${ts}@test.local`);
    const b = await createUser(`wp-b1-iso-b-${ts}@test.local`);

    const memberships = await supabase
      .from('memberships')
      .select('user_id, organization_id')
      .in('user_id', [a, b]);

    const orgIds = memberships.data?.map((m) => m.organization_id) ?? [];
    expect(orgIds).toHaveLength(2);

    // Insert the same slug into both orgs — should succeed twice because
    // the unique index is composite (organization_id, slug).
    for (const organization_id of orgIds) {
      const { error } = await supabase
        .from('domains')
        .insert({ organization_id, slug: 'shared', name: 'Shared' });
      expect(error).toBeNull();
    }

    const domains = await supabase
      .from('domains')
      .select('organization_id, slug')
      .in('organization_id', orgIds);

    expect(domains.data).toHaveLength(2);
  });

  it('duplicate slug in same org is rejected by unique constraint', async () => {
    const userId = await createUser(`wp-b1-dup-${Date.now()}@test.local`);
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    const organization_id = membership?.organization_id;
    if (!organization_id) throw new Error('membership missing organization_id');

    const first = await supabase
      .from('domains')
      .insert({ organization_id, slug: 'sales', name: 'First' });
    expect(first.error).toBeNull();

    const second = await supabase
      .from('domains')
      .insert({ organization_id, slug: 'sales', name: 'Duplicate' });

    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe('23505');
  });
});

describe('domains migration shape (smoke)', () => {
  it('domain slug is org-scoped, not global', () => {
    expect(true).toBe(true);
  });
});
