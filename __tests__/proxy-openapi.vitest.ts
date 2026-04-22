import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The proxy pulls the server row via a service-role Supabase client. Stub the
// factory so tests can inject per-case fixtures without touching Postgres.
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

import { encrypt } from '@/lib/crypto/encrypt';
import { proxyOpenApi } from '@/lib/mcp/proxy-openapi';
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

const readJsonBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const makeSpec = (path: string, method: string, operationId: string) => ({
  paths: {
    [path]: {
      [method]: { operationId },
    },
  },
});

const makeTool = (name: string): ToolRow => ({
  id: 'tool-id',
  server_id: 'srv',
  name,
  description: null,
  input_schema: { type: 'object' },
});

const ctx = { serverId: 'srv', traceId: 'trace-1' };

const ORIGINAL_SSRF_FLAG = process.env.SSRF_ALLOW_LOCALHOST;

describe('proxyOpenApi', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.SSRF_ALLOW_LOCALHOST = '1';
  });

  afterAll(() => {
    if (ORIGINAL_SSRF_FLAG === undefined) delete process.env.SSRF_ALLOW_LOCALHOST;
    else process.env.SSRF_ALLOW_LOCALHOST = ORIGINAL_SSRF_FLAG;
  });

  beforeEach(() => {
    serverFixture.current = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('injects a Bearer header from encrypted auth_config', async () => {
    let seenAuth: string | undefined;
    const { server, url } = await startUpstream((req, res) => {
      seenAuth = req.headers.authorization;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/ping', 'get', 'ping'),
        auth_config: { ciphertext: encrypt(JSON.stringify({ type: 'bearer', token: 'sk-abc' })) },
      };
      const result = await proxyOpenApi(makeTool('ping'), {}, ctx);
      expect(result.ok).toBe(true);
      expect(seenAuth).toBe('Bearer sk-abc');
    } finally {
      await stopUpstream(server);
    }
  });

  it('encodes Basic auth credentials correctly', async () => {
    let seenAuth: string | undefined;
    const { server, url } = await startUpstream((req, res) => {
      seenAuth = req.headers.authorization;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/ping', 'get', 'ping'),
        auth_config: {
          ciphertext: encrypt(JSON.stringify({ type: 'basic', username: 'alice', password: 'secret' })),
        },
      };
      await proxyOpenApi(makeTool('ping'), {}, ctx);
      const expected = `Basic ${Buffer.from('alice:secret').toString('base64')}`;
      expect(seenAuth).toBe(expected);
    } finally {
      await stopUpstream(server);
    }
  });

  it('sets a custom apikey-header', async () => {
    const seen: Record<string, string | string[] | undefined> = {};
    const { server, url } = await startUpstream((req, res) => {
      seen['x-api-key'] = req.headers['x-api-key'];
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/ping', 'get', 'ping'),
        auth_config: {
          ciphertext: encrypt(
            JSON.stringify({ type: 'apikey-header', header_name: 'X-Api-Key', header_value: 'deadbeef' }),
          ),
        },
      };
      await proxyOpenApi(makeTool('ping'), {}, ctx);
      expect(seen['x-api-key']).toBe('deadbeef');
    } finally {
      await stopUpstream(server);
    }
  });

  it('substitutes path parameters from args', async () => {
    let seenPath: string | undefined;
    const { server, url } = await startUpstream((req, res) => {
      seenPath = req.url;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: '42' }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/users/{id}', 'get', 'getUser'),
        auth_config: null,
      };
      await proxyOpenApi(makeTool('getUser'), { id: '42' }, ctx);
      expect(seenPath).toBe('/users/42');
    } finally {
      await stopUpstream(server);
    }
  });

  it('appends remaining args as query string for GET', async () => {
    let seenUrl: string | undefined;
    const { server, url } = await startUpstream((req, res) => {
      seenUrl = req.url;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ items: [] }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/search', 'get', 'search'),
        auth_config: null,
      };
      await proxyOpenApi(makeTool('search'), { q: 'claude', limit: 5 }, ctx);
      expect(seenUrl).toBeDefined();
      const parsed = new URL(`http://x${seenUrl}`);
      expect(parsed.searchParams.get('q')).toBe('claude');
      expect(parsed.searchParams.get('limit')).toBe('5');
    } finally {
      await stopUpstream(server);
    }
  });

  it('sends a JSON body for POST', async () => {
    let seenBody: string | undefined;
    let seenMethod: string | undefined;
    let seenContentType: string | undefined;
    const { server, url } = await startUpstream(async (req, res) => {
      seenMethod = req.method;
      seenContentType = req.headers['content-type'];
      seenBody = await readJsonBody(req);
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ created: true }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/tickets', 'post', 'createTicket'),
        auth_config: null,
      };
      const result = await proxyOpenApi(
        makeTool('createTicket'),
        { body: { title: 'hi', priority: 'low' } },
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(seenMethod).toBe('POST');
      expect(seenContentType).toBe('application/json');
      expect(JSON.parse(seenBody ?? '{}')).toEqual({ title: 'hi', priority: 'low' });
    } finally {
      await stopUpstream(server);
    }
  });

  it('retries once on 5xx then fails without leaking body', async () => {
    let calls = 0;
    const leakedBody = 'INTERNAL STACK TRACE — do not leak';
    const { server, url } = await startUpstream((_req, res) => {
      calls += 1;
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end(leakedBody);
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/ping', 'get', 'ping'),
        auth_config: null,
      };
      const result = await proxyOpenApi(makeTool('ping'), {}, ctx);
      expect(calls).toBe(2);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.error).toBe('upstream_error');
        expect(JSON.stringify(result)).not.toContain(leakedBody);
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('returns parsed JSON on 2xx success', async () => {
    const payload = { id: '42', name: 'Jane' };
    const { server, url } = await startUpstream((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'openapi',
        openapi_spec: makeSpec('/users/{id}', 'get', 'getUser'),
        auth_config: null,
      };
      const result = await proxyOpenApi(makeTool('getUser'), { id: '42' }, ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.result).toEqual(payload);
        expect(typeof result.latencyMs).toBe('number');
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('blocks a private-IP origin when the SSRF guard is engaged', async () => {
    const prev = process.env.SSRF_ALLOW_LOCALHOST;
    delete process.env.SSRF_ALLOW_LOCALHOST;
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: 'http://10.0.0.1/api',
        transport: 'openapi',
        openapi_spec: makeSpec('/ping', 'get', 'ping'),
        auth_config: null,
      };
      const result = await proxyOpenApi(makeTool('ping'), {}, ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('ssrf_blocked');
    } finally {
      if (prev !== undefined) process.env.SSRF_ALLOW_LOCALHOST = prev;
    }
  });
});
