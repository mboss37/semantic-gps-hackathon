import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked Slack proxy. Spins a local HTTP upstream that impersonates the
// Slack Web API base (slack.com/api). Exercises:
//   - users_lookup_by_email happy path + projection
//   - chat_post_message happy path (channel name + channel id variants)
//   - conversations_list happy path + default params
//   - Slack app-level error (HTTP 200 + {ok:false, error:...}) surfaces as origin_error
//   - Invalid input (bad email, empty text) rejected before any fetch
//   - SSRF-blocked host propagates as ssrf_blocked

const serverFixture: { current: Record<string, unknown> | null } = { current: null };

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: serverFixture.current, error: null }),
        }),
      }),
    }),
  }),
}));

// Rewrite the SLACK_API_BASE inside slackCall by patching safeFetch — the
// proxy always calls `https://slack.com/api/<method>`. We intercept via a
// spy that rewrites the URL to the local upstream, which is the cleanest
// way to test without leaking the constant into the module surface.
const originalFetchImpl = globalThis.fetch;

import { encrypt } from '@/lib/crypto/encrypt';
import { proxySlack } from '@/lib/mcp/proxy-slack';
import type { ToolRow } from '@/lib/manifest/cache';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const startUpstream = (handler: Handler): Promise<{ server: Server; url: string }> =>
  new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });

const stopUpstream = (server: Server): Promise<void> =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const makeTool = (name: string): ToolRow => ({
  id: `tool-${name}`,
  server_id: 'srv',
  name,
  description: null,
  input_schema: { type: 'object' },
});

const ctx = { serverId: 'srv', traceId: 'trace-slack' };

const makeAuthEnvelope = (token = 'xoxb-test-bot-token'): { ciphertext: string } => ({
  ciphertext: encrypt(JSON.stringify({ type: 'bot_token', bot_token: token })),
});

const ORIGINAL_SSRF_FLAG = process.env.SSRF_ALLOW_LOCALHOST;

// Slack proxy hardcodes `https://slack.com/api` as the base URL. Patch global
// fetch so we can swap the real host for a local test server while preserving
// the safeFetch → validateUrl pipeline (SSRF guard still runs against the
// rewritten localhost URL, which requires SSRF_ALLOW_LOCALHOST=1).
const installFetchRewriter = (baseUrl: string): void => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const rewritten = raw.replace('https://slack.com/api', baseUrl);
    return originalFetchImpl(rewritten, init);
  }) as typeof fetch;
};

const restoreFetch = (): void => {
  globalThis.fetch = originalFetchImpl;
};

describe('proxySlack', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.SSRF_ALLOW_LOCALHOST = '1';
  });

  afterAll(() => {
    if (ORIGINAL_SSRF_FLAG === undefined) delete process.env.SSRF_ALLOW_LOCALHOST;
    else process.env.SSRF_ALLOW_LOCALHOST = ORIGINAL_SSRF_FLAG;
    restoreFetch();
  });

  beforeEach(() => {
    serverFixture.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreFetch();
  });

  it('resolves users_lookup_by_email and projects to {id,name,email,real_name,is_bot}', async () => {
    let seenAuth: string | undefined;
    let seenMethod: string | undefined;
    let seenBody: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      seenAuth = req.headers.authorization;
      seenMethod = req.method ?? undefined;
      seenBody = await readBody(req);
      expect(req.url).toBe('/users.lookupByEmail');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          user: {
            id: 'U123',
            name: 'mihael',
            real_name: 'Mihael Bosnjak',
            is_bot: false,
            profile: { email: 'mihael@bosnjak.io', real_name: 'Mihael Bosnjak' },
          },
        }),
      );
    });
    installFetchRewriter(url);
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope('xoxb-abc'),
      };
      const result = await proxySlack(
        makeTool('users_lookup_by_email'),
        { email: 'mihael@bosnjak.io' },
        ctx,
      );
      expect(seenAuth).toBe('Bearer xoxb-abc');
      expect(seenMethod).toBe('POST');
      expect(JSON.parse(seenBody ?? '{}')).toEqual({ email: 'mihael@bosnjak.io' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.result).toEqual({
          id: 'U123',
          name: 'mihael',
          email: 'mihael@bosnjak.io',
          real_name: 'Mihael Bosnjak',
          is_bot: false,
        });
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('dispatches chat_post_message as POST with channel + text body', async () => {
    let seenBody: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      expect(req.url).toBe('/chat.postMessage');
      seenBody = await readBody(req);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          channel: 'C123',
          ts: '1700000000.000100',
          message: { text: 'hello', user: 'U1' },
        }),
      );
    });
    installFetchRewriter(url);
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope(),
      };
      const result = await proxySlack(
        makeTool('chat_post_message'),
        { channel: '#general', text: 'hello' },
        ctx,
      );
      expect(JSON.parse(seenBody ?? '{}')).toEqual({ channel: '#general', text: 'hello' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const r = result.result as { ok: boolean; channel: unknown; ts: unknown };
        expect(r.ok).toBe(true);
        expect(r.channel).toBe('C123');
        expect(r.ts).toBe('1700000000.000100');
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('dispatches conversations_list with default types + limit when args omitted', async () => {
    let seenBody: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      expect(req.url).toBe('/conversations.list');
      seenBody = await readBody(req);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          channels: [
            {
              id: 'C1',
              name: 'general',
              is_channel: true,
              is_private: false,
              num_members: 42,
              extra: 'ignored',
            },
            {
              id: 'C2',
              name: 'random',
              is_channel: true,
              is_private: false,
              num_members: 7,
            },
          ],
        }),
      );
    });
    installFetchRewriter(url);
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope(),
      };
      const result = await proxySlack(makeTool('conversations_list'), {}, ctx);
      expect(JSON.parse(seenBody ?? '{}')).toEqual({ types: 'public_channel', limit: 100 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const r = result.result as { channels: Array<Record<string, unknown>> };
        expect(r.channels).toHaveLength(2);
        expect(r.channels[0]).toEqual({
          id: 'C1',
          name: 'general',
          is_channel: true,
          is_private: false,
          num_members: 42,
        });
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('surfaces Slack app-level {ok:false, error:"channel_not_found"} as origin_error', async () => {
    const { server, url } = await startUpstream((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'channel_not_found' }));
    });
    installFetchRewriter(url);
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope(),
      };
      const result = await proxySlack(
        makeTool('chat_post_message'),
        { channel: '#does-not-exist', text: 'hi' },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('origin_error');
        expect(result.status).toBe(400);
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('rejects invalid users_lookup_by_email input before any fetch', async () => {
    let hit = false;
    const { server, url } = await startUpstream((_req, res) => {
      hit = true;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    installFetchRewriter(url);
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope(),
      };
      const result = await proxySlack(
        makeTool('users_lookup_by_email'),
        { email: 'not-an-email' },
        ctx,
      );
      expect(hit).toBe(false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_input');
        expect(result.status).toBe(400);
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('rejects empty chat_post_message text before any fetch', async () => {
    let hit = false;
    const { server, url } = await startUpstream((_req, res) => {
      hit = true;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    installFetchRewriter(url);
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope(),
      };
      const result = await proxySlack(
        makeTool('chat_post_message'),
        { channel: '#general', text: '' },
        ctx,
      );
      expect(hit).toBe(false);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('invalid_input');
    } finally {
      await stopUpstream(server);
    }
  });

  it('returns ssrf_blocked when the upstream fetch throws SsrfBlockedError', async () => {
    // Replace global fetch with a shim that throws the exact error
    // `safeFetch` would raise for a private-IP resolution. This exercises
    // the proxy's `catch(SsrfBlockedError)` branch without needing to defeat
    // validateUrl (which runs on the hard-coded `https://slack.com/api`).
    const { SsrfBlockedError } = await import('@/lib/security/ssrf-guard');
    globalThis.fetch = (async () => {
      throw new SsrfBlockedError('private_ip', 'blocked by test shim');
    }) as typeof fetch;
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'slack',
        auth_config: makeAuthEnvelope(),
      };
      const result = await proxySlack(
        makeTool('conversations_list'),
        { limit: 1 },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('ssrf_blocked');
    } finally {
      restoreFetch();
    }
  });

  it('returns wrong_transport when server row has a non-slack transport', async () => {
    serverFixture.current = {
      id: 'srv',
      transport: 'openapi',
      auth_config: makeAuthEnvelope(),
    };
    const result = await proxySlack(makeTool('users_lookup_by_email'), { email: 'a@b.co' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('wrong_transport');
  });
});
