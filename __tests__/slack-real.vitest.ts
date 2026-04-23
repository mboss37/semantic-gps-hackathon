import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encrypt } from '@/lib/crypto/encrypt';
import { proxySlack, type SlackAuthConfig } from '@/lib/mcp/proxy-slack';
import type { ToolRow } from '@/lib/manifest/cache';

// Opt-in live Slack proxy smoke.
//   VERIFY_SLACK=1 \
//   SLACK_BOT_TOKEN=xoxb-... \
//   pnpm test slack-real
//
// Calls `conversations.list` against the real workspace associated with the
// bot token. Read-only — we deliberately DO NOT test `chat.postMessage` in
// live mode to avoid spamming real channels during CI or a dev run.

const shouldRun = process.env.VERIFY_SLACK === '1' && !!process.env.SLACK_BOT_TOKEN;

const FAKE_SERVER_ID = '00000000-0000-0000-0000-000000000def';

describe.skipIf(!shouldRun)('slack live proxy (opt-in)', () => {
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

  it('lists conversations against a real Slack workspace', async () => {
    const creds: SlackAuthConfig = {
      type: 'bot_token',
      bot_token: process.env.SLACK_BOT_TOKEN ?? '',
    };
    const auth_config = { ciphertext: encrypt(JSON.stringify(creds)) };

    // Stub the service-client loader so the proxy sees an in-memory server
    // row without touching Supabase. Mirrors the SF opt-in test pattern.
    type AsyncSingle = { data: Record<string, unknown> | null; error: null };
    type FakeClient = {
      from: () => { select: () => { eq: () => { maybeSingle: () => Promise<AsyncSingle> } } };
    };
    const fake: FakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: FAKE_SERVER_ID, transport: 'slack', auth_config },
              error: null,
            }),
          }),
        }),
      }),
    };
    const mod = await import('@/lib/supabase/service');
    const originalImpl = mod.createServiceClient;
    (mod as unknown as { createServiceClient: () => FakeClient }).createServiceClient = () => fake;

    try {
      const tool: ToolRow = {
        id: 'tool-conversations-list',
        server_id: FAKE_SERVER_ID,
        name: 'conversations_list',
        description: null,
        input_schema: { type: 'object' },
      };
      const result = await proxySlack(
        tool,
        { limit: 10 },
        { serverId: FAKE_SERVER_ID, traceId: `slack-real-${Date.now()}` },
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const channels = (result.result as { channels: Array<{ id: string | null }> }).channels;
        expect(Array.isArray(channels)).toBe(true);
      }
    } finally {
      (mod as unknown as { createServiceClient: typeof originalImpl }).createServiceClient = originalImpl;
    }
  }, 30_000);
});

describe('slack-real smoke shape', () => {
  it('loads without env (skipIf gate works)', () => {
    expect(true).toBe(true);
  });
});
