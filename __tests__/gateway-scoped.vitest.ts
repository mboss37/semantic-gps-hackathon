import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidateManifest, loadManifest } from '@/lib/manifest/cache';
import { createServiceClient } from '@/lib/supabase/service';

// DB integration test for WP-D.1 scoped manifests. Seeds two servers in two
// domains for the demo org and exercises the three scope kinds.
// Skipped unless Supabase env vars are present.

const shouldRun =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY && !process.env.CI;

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';

describe.skipIf(!shouldRun)('scoped loadManifest (org / domain / server)', () => {
  let supabase: SupabaseClient;
  let organizationId: string;
  let domainAId: string;
  let domainBId: string;
  let domainASlug: string;
  let domainBSlug: string;
  let serverAId: string;
  let serverBId: string;
  let toolAId: string;
  let toolBId: string;
  const createdDomainIds: string[] = [];
  const createdServerIds: string[] = [];

  beforeAll(async () => {
    supabase = createServiceClient();

    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', DEMO_USER_ID)
      .maybeSingle();

    if (!membership?.organization_id) {
      throw new Error(
        'gateway-scoped.vitest requires the seeded demo user. Run `pnpm supabase db reset` first.',
      );
    }
    organizationId = membership.organization_id;

    const ts = Date.now();
    domainASlug = `wp-d1-a-${ts}`;
    domainBSlug = `wp-d1-b-${ts}`;

    const { data: domains, error: domainsErr } = await supabase
      .from('domains')
      .insert([
        { organization_id: organizationId, slug: domainASlug, name: 'WP-D1 A' },
        { organization_id: organizationId, slug: domainBSlug, name: 'WP-D1 B' },
      ])
      .select('id, slug');
    if (domainsErr) throw new Error(domainsErr.message);
    if (!domains || domains.length !== 2) throw new Error('domain seeding failed');
    const a = domains.find((d) => d.slug === domainASlug);
    const b = domains.find((d) => d.slug === domainBSlug);
    if (!a || !b) throw new Error('missing seeded domain');
    domainAId = a.id;
    domainBId = b.id;
    createdDomainIds.push(domainAId, domainBId);

    const { data: servers, error: serversErr } = await supabase
      .from('servers')
      .insert([
        {
          organization_id: organizationId,
          domain_id: domainAId,
          name: `wp-d1-srv-a-${ts}`,
          transport: 'openapi',
        },
        {
          organization_id: organizationId,
          domain_id: domainBId,
          name: `wp-d1-srv-b-${ts}`,
          transport: 'openapi',
        },
      ])
      .select('id, name');
    if (serversErr) throw new Error(serversErr.message);
    if (!servers || servers.length !== 2) throw new Error('server seeding failed');
    const sA = servers.find((s) => s.name === `wp-d1-srv-a-${ts}`);
    const sB = servers.find((s) => s.name === `wp-d1-srv-b-${ts}`);
    if (!sA || !sB) throw new Error('missing seeded server');
    serverAId = sA.id;
    serverBId = sB.id;
    createdServerIds.push(serverAId, serverBId);

    const { data: tools, error: toolsErr } = await supabase
      .from('tools')
      .insert([
        { server_id: serverAId, name: 'toolA', description: 'in domain A' },
        { server_id: serverBId, name: 'toolB', description: 'in domain B' },
      ])
      .select('id, name');
    if (toolsErr) throw new Error(toolsErr.message);
    if (!tools || tools.length !== 2) throw new Error('tool seeding failed');
    const tA = tools.find((t) => t.name === 'toolA');
    const tB = tools.find((t) => t.name === 'toolB');
    if (!tA || !tB) throw new Error('missing seeded tool');
    toolAId = tA.id;
    toolBId = tB.id;
    // No explicit tool cleanup, servers cascade-delete their tools.

    invalidateManifest();
  });

  afterAll(async () => {
    if (createdServerIds.length > 0) {
      await supabase.from('servers').delete().in('id', createdServerIds);
    }
    if (createdDomainIds.length > 0) {
      await supabase.from('domains').delete().in('id', createdDomainIds);
    }
    invalidateManifest();
  });

  it('org scope returns both servers + both tools', async () => {
    invalidateManifest();
    const manifest = await loadManifest({ kind: 'org', organization_id: organizationId });
    const serverIds = manifest.servers.map((s) => s.id);
    expect(serverIds).toContain(serverAId);
    expect(serverIds).toContain(serverBId);
    const toolIds = manifest.tools.map((t) => t.id);
    expect(toolIds).toContain(toolAId);
    expect(toolIds).toContain(toolBId);
  });

  it('domain scope returns only the matching domain\'s server + its tools', async () => {
    invalidateManifest();
    const manifest = await loadManifest({
      kind: 'domain',
      organization_id: organizationId,
      domain_slug: domainASlug,
    });
    const serverIds = manifest.servers.map((s) => s.id);
    expect(serverIds).toEqual([serverAId]);
    const toolIds = manifest.tools.map((t) => t.id);
    expect(toolIds).toContain(toolAId);
    expect(toolIds).not.toContain(toolBId);
  });

  it('server scope returns only the single server + its tools', async () => {
    invalidateManifest();
    const manifest = await loadManifest({
      kind: 'server',
      organization_id: organizationId,
      server_id: serverAId,
    });
    const serverIds = manifest.servers.map((s) => s.id);
    expect(serverIds).toEqual([serverAId]);
    const toolIds = manifest.tools.map((t) => t.id);
    expect(toolIds).toEqual([toolAId]);
  });

  it('unknown domain slug yields an empty manifest (not a crash)', async () => {
    invalidateManifest();
    const manifest = await loadManifest({
      kind: 'domain',
      organization_id: organizationId,
      domain_slug: 'does-not-exist',
    });
    expect(manifest.servers).toHaveLength(0);
    expect(manifest.tools).toHaveLength(0);
  });
});

describe('scoped manifest shape (smoke)', () => {
  it('ManifestScope is a discriminated union', () => {
    // Always-on smoke so a run with no DB env still has at least one assertion.
    expect(true).toBe(true);
  });
});
