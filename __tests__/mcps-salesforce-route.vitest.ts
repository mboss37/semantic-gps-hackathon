import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetSalesforceTokenCacheForTests,
} from '@/lib/mcp/vendors/salesforce';
import { POST } from '@/app/api/mcps/salesforce/route';

// End-to-end tests for the Salesforce vendor MCP route. Spins a local HTTP
// upstream on an ephemeral port that impersonates BOTH the OAuth token
// endpoint and the REST/SOQL endpoints, then POSTs JSON-RPC frames into the
// route and asserts the shape coming back.
//
// Requires SSRF_ALLOW_LOCALHOST=1 because the route uses `safeFetch` which
// otherwise blocks 127.0.0.1 resolutions.

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

const rpc = (method: string, params?: Record<string, unknown>, id: string | number = 1): Request =>
  new Request('http://localhost/api/mcps/salesforce', {
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
const ORIGINAL_SF_LOGIN = process.env.SF_LOGIN_URL;
const ORIGINAL_SF_ID = process.env.SF_CLIENT_ID;
const ORIGINAL_SF_SECRET = process.env.SF_CLIENT_SECRET;

describe('POST /api/mcps/salesforce', () => {
  beforeAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.SSRF_ALLOW_LOCALHOST = '1';
    process.env.SF_CLIENT_ID = 'client-id';
    process.env.SF_CLIENT_SECRET = 'client-secret';
  });

  afterAll(() => {
    if (ORIGINAL_SSRF_FLAG === undefined) delete process.env.SSRF_ALLOW_LOCALHOST;
    else process.env.SSRF_ALLOW_LOCALHOST = ORIGINAL_SSRF_FLAG;
    if (ORIGINAL_SF_LOGIN === undefined) delete process.env.SF_LOGIN_URL;
    else process.env.SF_LOGIN_URL = ORIGINAL_SF_LOGIN;
    if (ORIGINAL_SF_ID === undefined) delete process.env.SF_CLIENT_ID;
    else process.env.SF_CLIENT_ID = ORIGINAL_SF_ID;
    if (ORIGINAL_SF_SECRET === undefined) delete process.env.SF_CLIENT_SECRET;
    else process.env.SF_CLIENT_SECRET = ORIGINAL_SF_SECRET;
  });

  beforeEach(() => {
    __resetSalesforceTokenCacheForTests();
  });

  afterEach(() => {
    delete process.env.SF_LOGIN_URL;
  });

  it('tools/list returns all 6 curated Salesforce tools', async () => {
    process.env.SF_LOGIN_URL = 'https://example.test';
    const res = await POST(rpc('tools/list'));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.error).toBeUndefined();
    const result = body.result as { tools: Array<{ name: string }> };
    expect(result.tools.map((t) => t.name).sort()).toEqual([
      'create_task',
      'delete_task',
      'find_account',
      'find_contact',
      'get_opportunity',
      'update_opportunity_stage',
    ]);
  });

  it('tools/call find_account runs OAuth + SOQL against the real upstream shape', async () => {
    let tokenCalls = 0;
    let seenQuery: string | null = null;
    const { server, url } = await startUpstream(async (req, res) => {
      if (req.url?.startsWith('/services/oauth2/token')) {
        tokenCalls += 1;
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
    process.env.SF_LOGIN_URL = url;
    try {
      const res = await POST(
        rpc('tools/call', { name: 'find_account', arguments: { query: 'Edge' } }),
      );
      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.error).toBeUndefined();
      const result = body.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toHaveLength(1);
      const inner = JSON.parse(result.content[0].text) as { records: Array<{ Name: string }> };
      expect(inner.records[0].Name).toBe('Edge Communications');
      expect(tokenCalls).toBe(1);
      expect(seenQuery).toContain("Name LIKE '%Edge%'");
    } finally {
      await stopUpstream(server);
    }
  });

  it('unknown method returns JSON-RPC -32601', async () => {
    process.env.SF_LOGIN_URL = 'https://example.test';
    const res = await POST(rpc('nonexistent/method'));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.error?.code).toBe(-32601);
  });

  it('tools/call with unknown tool name returns -32602', async () => {
    process.env.SF_LOGIN_URL = 'https://example.test';
    const res = await POST(rpc('tools/call', { name: 'bogus_tool', arguments: {} }));
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.error?.code).toBe(-32602);
    const data = body.error?.data as { reason?: string } | undefined;
    expect(data?.reason).toBe('unknown_tool');
  });

  it('tools/call with invalid args surfaces vendor invalid_input error', async () => {
    // No upstream needed, validation rejects before any fetch. We still set
    // SF_LOGIN_URL to satisfy the creds-missing check in dispatchSalesforceTool.
    process.env.SF_LOGIN_URL = 'https://example.test';
    // Token mint will be attempted (dispatcher calls getAccessToken before
    // per-tool validation). Point SF_LOGIN_URL at a TCP dead port so we never
    // accidentally reach a real org; the ssrf-guard timeout will fire. To keep
    // the test fast we instead force a local upstream that answers with 200.
    const { server, url } = await startUpstream((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          access_token: 'at-x',
          instance_url: 'http://127.0.0.1:1',
          expires_in: 7200,
        }),
      );
    });
    process.env.SF_LOGIN_URL = url;
    try {
      const res = await POST(
        rpc('tools/call', {
          name: 'get_opportunity',
          arguments: { id: 'not-a-valid-id!' },
        }),
      );
      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.error?.code).toBe(-32000);
      const data = body.error?.data as { reason?: string; status?: number } | undefined;
      expect(data?.reason).toBe('invalid_input');
      expect(data?.status).toBe(400);
    } finally {
      await stopUpstream(server);
    }
  });
});
