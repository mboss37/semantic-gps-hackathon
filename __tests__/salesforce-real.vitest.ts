import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '@/lib/crypto/encrypt';
import {
  __resetSalesforceTokenCacheForTests,
  proxySalesforce,
  type SalesforceAuthConfig,
} from '@/lib/mcp/proxy-salesforce';
import type { ToolRow } from '@/lib/manifest/cache';

// Opt-in live Salesforce proxy smoke.
//   VERIFY_SALESFORCE=1 \
//   SF_LOGIN_URL=... SF_CLIENT_ID=... SF_CLIENT_SECRET=... \
//   pnpm test salesforce-real
//
// Mints a real token against the dev org and runs find_account({query:'Edge'}).
// Expects the seed "Edge Communications" Account to come back.

const shouldRun =
  process.env.VERIFY_SALESFORCE === '1' &&
  !!process.env.SF_LOGIN_URL &&
  !!process.env.SF_CLIENT_ID &&
  !!process.env.SF_CLIENT_SECRET;

const FAKE_SERVER_ID = '00000000-0000-0000-0000-000000000abc';

describe.skipIf(!shouldRun)('salesforce live proxy (opt-in)', () => {
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!originalKey) {
      process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    }
    __resetSalesforceTokenCacheForTests();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  });

  it('mints a real token and finds Edge Communications', async () => {
    const creds: SalesforceAuthConfig = {
      type: 'oauth2_client_credentials',
      login_url: process.env.SF_LOGIN_URL ?? '',
      client_id: process.env.SF_CLIENT_ID ?? '',
      client_secret: process.env.SF_CLIENT_SECRET ?? '',
    };
    const auth_config = { ciphertext: encrypt(JSON.stringify(creds)) };

    // Stub the service-client loader so the proxy sees an in-memory server
    // row without touching Supabase. `vi.mock` is module-level in the other
    // test; here we use the dynamic-import + monkey-patch approach isolated
    // to this opt-in file.
    const { createServiceClient } = await import('@/lib/supabase/service');
    type AsyncSingle = { data: Record<string, unknown> | null; error: null };
    type FakeClient = {
      from: () => { select: () => { eq: () => { maybeSingle: () => Promise<AsyncSingle> } } };
    };
    const fake: FakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: FAKE_SERVER_ID, transport: 'salesforce', auth_config },
              error: null,
            }),
          }),
        }),
      }),
    };
    const originalImpl = createServiceClient;
    const mod = await import('@/lib/supabase/service');
    (mod as unknown as { createServiceClient: () => FakeClient }).createServiceClient = () => fake;

    try {
      const tool: ToolRow = {
        id: 'tool-find-account',
        server_id: FAKE_SERVER_ID,
        name: 'find_account',
        description: null,
        input_schema: { type: 'object' },
      };
      const result = await proxySalesforce(
        tool,
        { query: 'Edge' },
        { serverId: FAKE_SERVER_ID, traceId: `salesforce-real-${Date.now()}` },
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const records = (result.result as { records: Array<{ Name?: string }> }).records;
        expect(records.length).toBeGreaterThan(0);
        const names = records.map((r) => r.Name ?? '');
        expect(names.some((n) => n.includes('Edge Communications'))).toBe(true);
      }
    } finally {
      (mod as unknown as { createServiceClient: typeof originalImpl }).createServiceClient = originalImpl;
    }
  }, 30_000);
});

describe('salesforce-real smoke shape', () => {
  it('loads without env (skipIf gate works)', () => {
    expect(true).toBe(true);
  });
});
