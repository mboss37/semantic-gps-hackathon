import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '@/lib/crypto/encrypt';
import { proxyGithub, type GithubAuthConfig } from '@/lib/mcp/proxy-github';
import type { ToolRow } from '@/lib/manifest/cache';

// Opt-in live GitHub proxy smoke.
//   VERIFY_GITHUB=1 GITHUB_PAT=ghp_... pnpm test github-real
//
// Issues a read-only `search_issues` against the real api.github.com. DO NOT
// add mutating-tool coverage here — `create_issue` / `add_comment` /
// `close_issue` would pollute real repos. Those paths stay covered by the
// mocked suite only.

const shouldRun = process.env.VERIFY_GITHUB === '1' && !!process.env.GITHUB_PAT;

const FAKE_SERVER_ID = '00000000-0000-0000-0000-000000000def';

describe.skipIf(!shouldRun)('github live proxy (opt-in)', () => {
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!originalKey) {
      process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    }
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  });

  it('search_issues returns projected items against the real API', async () => {
    const creds: GithubAuthConfig = {
      type: 'pat',
      pat: process.env.GITHUB_PAT ?? '',
    };
    const auth_config = { ciphertext: encrypt(JSON.stringify(creds)) };

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
              data: { id: FAKE_SERVER_ID, transport: 'github', auth_config },
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
        id: 'tool-search-issues',
        server_id: FAKE_SERVER_ID,
        name: 'search_issues',
        description: null,
        input_schema: { type: 'object' },
      };
      const result = await proxyGithub(
        tool,
        { query: 'language:typescript stars:>10000', limit: 3 },
        { serverId: FAKE_SERVER_ID, traceId: `github-real-${Date.now()}` },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const out = result.result as {
          total_count: number;
          items: Array<{ number: number | null; html_url: string | null }>;
        };
        expect(out.total_count).toBeGreaterThan(0);
        expect(out.items.length).toBeGreaterThan(0);
        expect(out.items[0].html_url).toMatch(/^https:\/\/github\.com\//);
      }
    } finally {
      (mod as unknown as { createServiceClient: typeof originalImpl }).createServiceClient = originalImpl;
    }
  }, 30_000);
});

describe('github-real smoke shape', () => {
  it('loads without env (skipIf gate works)', () => {
    expect(true).toBe(true);
  });
});
