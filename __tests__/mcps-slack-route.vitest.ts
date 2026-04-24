import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/mcps/slack/route';

// End-to-end tests for the Slack vendor MCP route. Slack proxy hard-codes
// `https://slack.com/api` as the base URL; we swap global fetch with a
// rewriter so the adapter reaches a local upstream instead.

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const originalFetch = globalThis.fetch;

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

const installFetchRewriter = (baseUrl: string): void => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const rewritten = raw.replace('https://slack.com/api', baseUrl);
    return originalFetch(rewritten, init);
  }) as typeof fetch;
};

const restoreFetch = (): void => {
  globalThis.fetch = originalFetch;
};

const rpc = (method: string, params?: Record<string, unknown>, id: string | number = 1): Request =>
  new Request('http://localhost/api/mcps/slack', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

type JsonRpcResponseBody = {
  jsonrpc: '2.0';
  id: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const parseBody = async (res: Response): Promise<JsonRpcResponseBody> => {
  const text = await res.text();
  return JSON.parse(text) as JsonRpcResponseBody;
};

const ORIGINAL_SSRF_FLAG = process.env.SSRF_ALLOW_LOCALHOST;
const ORIGINAL_SLACK = process.env.SLACK_BOT_TOKEN;

describe('POST /api/mcps/slack', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.SSRF_ALLOW_LOCALHOST = '1';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
  });

  afterAll(() => {
    if (ORIGINAL_SSRF_FLAG === undefined) delete process.env.SSRF_ALLOW_LOCALHOST;
    else process.env.SSRF_ALLOW_LOCALHOST = ORIGINAL_SSRF_FLAG;
    if (ORIGINAL_SLACK === undefined) delete process.env.SLACK_BOT_TOKEN;
    else process.env.SLACK_BOT_TOKEN = ORIGINAL_SLACK;
    restoreFetch();
  });

  beforeEach(() => {
    restoreFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  it('tools/list returns all 4 curated Slack tools', async () => {
    const res = await POST(rpc('tools/list'));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.error).toBeUndefined();
    const result = body.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((t) => t.name).sort()).toEqual([
      'chat_post_message',
      'conversations_list',
      'delete_message',
      'users_lookup_by_email',
    ]);
  });

  it('tools/call users_lookup_by_email happy path projects the user object', async () => {
    let seenAuth: string | undefined;
    const { server, url } = await startUpstream(async (req, res) => {
      seenAuth = req.headers.authorization;
      expect(req.url).toBe('/users.lookupByEmail');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          user: {
            id: 'U1',
            name: 'mihael',
            real_name: 'Mihael Bosnjak',
            is_bot: false,
            profile: { email: 'm@example.com' },
          },
        }),
      );
    });
    installFetchRewriter(url);
    try {
      const res = await POST(
        rpc('tools/call', {
          name: 'users_lookup_by_email',
          arguments: { email: 'm@example.com' },
        }),
      );
      expect(res.status).toBe(200);
      expect(seenAuth).toBe('Bearer xoxb-test-token');
      const body = await parseBody(res);
      expect(body.error).toBeUndefined();
      const result = body.result as { content: Array<{ type: string; text: string }> };
      const inner = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(inner).toEqual({
        id: 'U1',
        name: 'mihael',
        email: 'm@example.com',
        real_name: 'Mihael Bosnjak',
        is_bot: false,
      });
    } finally {
      await stopUpstream(server);
    }
  });

  it('unknown method returns -32601', async () => {
    const res = await POST(rpc('unknown/method'));
    const body = await parseBody(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('tools/call with invalid email rejects before any Slack request', async () => {
    let hit = false;
    const { server, url } = await startUpstream((_req, res) => {
      hit = true;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    installFetchRewriter(url);
    try {
      const res = await POST(
        rpc('tools/call', {
          name: 'users_lookup_by_email',
          arguments: { email: 'not-an-email' },
        }),
      );
      const body = await parseBody(res);
      expect(hit).toBe(false);
      expect(body.error?.code).toBe(-32000);
      const data = body.error?.data as { reason?: string } | undefined;
      expect(data?.reason).toBe('invalid_input');
    } finally {
      await stopUpstream(server);
    }
  });
});
