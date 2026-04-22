import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { proxyHttp } from '@/lib/mcp/proxy-http';
import type { ToolRow } from '@/lib/manifest/cache';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const startUpstream = (handler: Handler): Promise<{ server: Server; url: string }> =>
  new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${addr.port}/mcp` });
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
  id: 'tool-id',
  server_id: 'srv',
  name,
  description: null,
  input_schema: { type: 'object' },
});

const ctx = { serverId: 'srv', traceId: 'trace-xyz' };

const ORIGINAL_SSRF_FLAG = process.env.SSRF_ALLOW_LOCALHOST;

describe('proxyHttp', () => {
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

  it('parses a plain JSON tools/call response', async () => {
    const content = [{ type: 'text', text: 'ok' }];
    const { server, url } = await startUpstream(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 'trace-xyz', result: { content } }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'http-streamable',
        auth_config: null,
      };
      const result = await proxyHttp(makeTool('anything'), {}, ctx);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.result).toEqual(content);
    } finally {
      await stopUpstream(server);
    }
  });

  it('parses a single-event SSE response body', async () => {
    const content = [{ type: 'text', text: 'ok' }];
    const { server, url } = await startUpstream((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: 'trace-xyz',
        result: { content },
      });
      res.end(`event: message\ndata: ${payload}\n\n`);
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'http-streamable',
        auth_config: null,
      };
      const result = await proxyHttp(makeTool('anything'), {}, ctx);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.result).toEqual(content);
    } finally {
      await stopUpstream(server);
    }
  });

  it('normalizes JSON-RPC errors without leaking upstream details', async () => {
    const upstreamMsg = 'internal detail that must not leak';
    const { server, url } = await startUpstream((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'trace-xyz',
          error: { code: -32600, message: upstreamMsg },
        }),
      );
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'http-streamable',
        auth_config: null,
      };
      const result = await proxyHttp(makeTool('anything'), {}, ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('upstream_jsonrpc_error');
        expect(JSON.stringify(result)).not.toContain(upstreamMsg);
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('forwards the Bearer token on outgoing requests', async () => {
    let seenAuth: string | undefined;
    let seenBody: string | undefined;
    const { server, url } = await startUpstream(async (req, res) => {
      seenAuth = req.headers.authorization;
      seenBody = await readBody(req);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 'trace-xyz', result: { content: [] } }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: url,
        transport: 'http-streamable',
        auth_config: { ciphertext: encrypt(JSON.stringify({ type: 'bearer', token: 'sk-upstream' })) },
      };
      await proxyHttp(makeTool('do_thing'), { a: 1 }, ctx);
      expect(seenAuth).toBe('Bearer sk-upstream');
      const payload = JSON.parse(seenBody ?? '{}');
      expect(payload.method).toBe('tools/call');
      expect(payload.params).toEqual({ name: 'do_thing', arguments: { a: 1 } });
    } finally {
      await stopUpstream(server);
    }
  });

  it('blocks a private-IP origin when SSRF guard is engaged', async () => {
    const prev = process.env.SSRF_ALLOW_LOCALHOST;
    delete process.env.SSRF_ALLOW_LOCALHOST;
    try {
      serverFixture.current = {
        id: 'srv',
        origin_url: 'http://192.168.1.5/mcp',
        transport: 'http-streamable',
        auth_config: null,
      };
      const result = await proxyHttp(makeTool('x'), {}, ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('ssrf_blocked');
    } finally {
      if (prev !== undefined) process.env.SSRF_ALLOW_LOCALHOST = prev;
    }
  });
});
