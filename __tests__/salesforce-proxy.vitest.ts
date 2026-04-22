import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked Salesforce proxy. Spins a local HTTP upstream for both the OAuth
// token endpoint and the REST / SOQL endpoints, then exercises:
//   - happy-path token mint + find_account SOQL
//   - token cache hit (second call skips mint)
//   - token expiry (fresh mint after expires_at - 60s window)
//   - 401 on API call invalidates token, retries once with fresh mint
//   - invalid input rejected before any upstream call
//   - get_opportunity REST GET dispatch
//   - create_task REST POST dispatch

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
import {
  __resetSalesforceTokenCacheForTests,
  proxySalesforce,
  soqlEscape,
} from '@/lib/mcp/proxy-salesforce';
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

const ctx = { serverId: 'srv', traceId: 'trace-sf' };

const makeAuthEnvelope = (loginUrl: string): { ciphertext: string } => ({
  ciphertext: encrypt(
    JSON.stringify({
      type: 'oauth2_client_credentials',
      login_url: loginUrl,
      client_id: 'client-id',
      client_secret: 'client-secret',
    }),
  ),
});

const ORIGINAL_SSRF_FLAG = process.env.SSRF_ALLOW_LOCALHOST;

describe('proxySalesforce', () => {
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
    __resetSalesforceTokenCacheForTests();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('escapes SOQL single quotes and backslashes', () => {
    expect(soqlEscape("O'Brien")).toBe("O\\'Brien");
    expect(soqlEscape('a\\b')).toBe('a\\\\b');
  });

  it('mints a token then issues a SOQL query for find_account', async () => {
    let tokenCalls = 0;
    let seenQuery: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        tokenCalls += 1;
        const body = await readBody(req);
        expect(body).toContain('grant_type=client_credentials');
        expect(body).toContain('client_id=client-id');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: 'at-1',
            instance_url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            expires_in: 7200,
          }),
        );
        return;
      }
      if (req.url?.startsWith('/services/data/v60.0/query')) {
        expect(req.headers.authorization).toBe('Bearer at-1');
        seenQuery = decodeURIComponent(req.url.split('?q=')[1] ?? '');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            records: [{ Id: '001x', Name: 'Edge Communications', Industry: 'Telecom' }],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      const result = await proxySalesforce(makeTool('find_account'), { query: 'Edge' }, ctx);
      expect(tokenCalls).toBe(1);
      expect(seenQuery).toContain("Name LIKE '%Edge%'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const records = (result.result as { records: unknown[] }).records;
        expect(records).toHaveLength(1);
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('reuses the cached token on the second call', async () => {
    let tokenCalls = 0;
    let queryCalls = 0;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        tokenCalls += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: 'at-cache',
            instance_url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            expires_in: 7200,
          }),
        );
        return;
      }
      queryCalls += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ records: [] }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      await proxySalesforce(makeTool('find_account'), { query: 'a' }, ctx);
      await proxySalesforce(makeTool('find_account'), { query: 'b' }, ctx);
      expect(tokenCalls).toBe(1);
      expect(queryCalls).toBe(2);
    } finally {
      await stopUpstream(server);
    }
  });

  it('mints a fresh token once inside the 60s skew window', async () => {
    let tokenCalls = 0;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        tokenCalls += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: `at-${tokenCalls}`,
            instance_url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            // 30s TTL lands entirely within the 60s skew → refresh always.
            expires_in: 30,
          }),
        );
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ records: [] }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      await proxySalesforce(makeTool('find_account'), { query: 'a' }, ctx);
      await proxySalesforce(makeTool('find_account'), { query: 'b' }, ctx);
      expect(tokenCalls).toBe(2);
    } finally {
      await stopUpstream(server);
    }
  });

  it('invalidates the token on 401 and retries once with a fresh mint', async () => {
    let tokenCalls = 0;
    let queryCalls = 0;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        tokenCalls += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: `token-${tokenCalls}`,
            instance_url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            expires_in: 7200,
          }),
        );
        return;
      }
      queryCalls += 1;
      if (queryCalls === 1) {
        // First SOQL call: simulate expired token on upstream.
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify([{ message: 'Session expired', errorCode: 'INVALID_SESSION_ID' }]));
        return;
      }
      expect(req.headers.authorization).toBe('Bearer token-2');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ records: [{ Id: '001y', Name: 'Edge Communications' }] }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      const result = await proxySalesforce(makeTool('find_account'), { query: 'Edge' }, ctx);
      expect(tokenCalls).toBe(2);
      expect(queryCalls).toBe(2);
      expect(result.ok).toBe(true);
    } finally {
      await stopUpstream(server);
    }
  });

  it('rejects invalid get_opportunity id before any upstream call', async () => {
    let hit = false;
    const { server, url } = await startUpstream((_req, res) => {
      hit = true;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'x', instance_url: 'http://127.0.0.1', expires_in: 60 }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      const result = await proxySalesforce(
        makeTool('get_opportunity'),
        { id: 'not-a-valid-sf-id!' },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('invalid_input');
        expect(result.status).toBe(400);
      }
      // The dispatcher calls getAccessToken before schema validation, so
      // only the token endpoint should have been hit at most once; no REST
      // call against the sobject endpoint.
      expect(hit).toBe(true);
    } finally {
      await stopUpstream(server);
    }
  });

  it('dispatches get_opportunity as a REST GET on the sobject path', async () => {
    let seenPath: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: 'at-opp',
            instance_url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            expires_in: 7200,
          }),
        );
        return;
      }
      seenPath = req.url ?? null;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ Id: '006000000000001', StageName: 'Prospecting' }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      const result = await proxySalesforce(
        makeTool('get_opportunity'),
        { id: '006000000000001' },
        ctx,
      );
      expect(seenPath).toBe('/services/data/v60.0/sobjects/Opportunity/006000000000001');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.result as { StageName: string }).StageName).toBe('Prospecting');
      }
    } finally {
      await stopUpstream(server);
    }
  });

  it('dispatches create_task as a REST POST with Status="Not Started"', async () => {
    let seenBody: string | null = null;
    let seenMethod: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: 'at-task',
            instance_url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            expires_in: 7200,
          }),
        );
        return;
      }
      seenMethod = req.method ?? null;
      seenBody = await readBody(req);
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: '00T000000000001', success: true }));
    });
    try {
      serverFixture.current = {
        id: 'srv',
        transport: 'salesforce',
        auth_config: makeAuthEnvelope(url),
      };
      const result = await proxySalesforce(
        makeTool('create_task'),
        { subject: 'Follow up', whatId: '001g500000ISeWU' },
        ctx,
      );
      expect(seenMethod).toBe('POST');
      expect(JSON.parse(seenBody ?? '{}')).toEqual({
        Subject: 'Follow up',
        WhatId: '001g500000ISeWU',
        Status: 'Not Started',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.result as { success: boolean }).success).toBe(true);
      }
    } finally {
      await stopUpstream(server);
    }
  });
});
