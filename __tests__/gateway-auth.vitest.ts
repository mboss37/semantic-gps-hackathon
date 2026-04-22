import { describe, expect, it, vi } from 'vitest';

// WP-D.2: bearer-token auth on the MCP gateway.
// Matrix: missing header, wrong scheme, unknown token, valid token, cross-org.
// Uses a hoisted spy so each case can swap the stubbed return value.

const { resolveOrgFromTokenMock } = vi.hoisted(() => ({
  resolveOrgFromTokenMock: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({}),
}));
vi.mock('@/lib/mcp/auth-token', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/mcp/auth-token')>(
      '@/lib/mcp/auth-token',
    );
  return {
    ...actual,
    resolveOrgFromToken: resolveOrgFromTokenMock,
  };
});

const ORG_A = '00000000-0000-0000-0000-0000000000a1';
const ORG_B = '00000000-0000-0000-0000-0000000000b2';

const { POST } = await import('@/app/api/mcp/route');

type JsonRpcEnvelope = {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const unwrapJson = async (res: Response): Promise<JsonRpcEnvelope> => {
  const text = await res.text();
  const sseMatch = text.match(/data:\s*(\{[\s\S]*\})/);
  const payload = sseMatch ? sseMatch[1] : text;
  return JSON.parse(payload) as JsonRpcEnvelope;
};

const postGateway = async (init: RequestInit): Promise<Response> => {
  const request = new Request('http://localhost/api/mcp', {
    method: 'POST',
    ...init,
  });
  return POST(request);
};

const toolsListBody = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };

describe('gateway bearer auth (WP-D.2)', () => {
  it('returns 401 JSON-RPC envelope when Authorization header is missing', async () => {
    resolveOrgFromTokenMock.mockReset();
    const res = await postGateway({
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(toolsListBody),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await unwrapJson(res);
    expect(body).toEqual({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'unauthorized' },
      id: null,
    });
    expect(resolveOrgFromTokenMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the scheme is not Bearer', async () => {
    resolveOrgFromTokenMock.mockReset();
    const res = await postGateway({
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Digest sgps_demo_token_abcdef0123456789abcdef0123456789abcd',
      },
      body: JSON.stringify(toolsListBody),
    });

    expect(res.status).toBe(401);
    const body = await unwrapJson(res);
    expect(body.error?.code).toBe(-32001);
    expect(resolveOrgFromTokenMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token is unknown', async () => {
    resolveOrgFromTokenMock.mockReset();
    resolveOrgFromTokenMock.mockResolvedValueOnce(null);

    const res = await postGateway({
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer totally-unknown',
      },
      body: JSON.stringify(toolsListBody),
    });

    expect(res.status).toBe(401);
    const body = await unwrapJson(res);
    expect(body.error?.code).toBe(-32001);
    expect(resolveOrgFromTokenMock).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid bearer and serves tools/list', async () => {
    resolveOrgFromTokenMock.mockReset();
    resolveOrgFromTokenMock.mockResolvedValueOnce({ organization_id: ORG_A });

    const res = await postGateway({
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'bearer sgps_demo_token_abcdef0123456789abcdef0123456789abcd',
      },
      body: JSON.stringify(toolsListBody),
    });

    expect(res.status).toBe(200);
    const body = await unwrapJson(res);
    expect(body.error).toBeUndefined();
    const tools = body.result?.tools as Array<{ name: string }> | undefined;
    expect(tools?.find((t) => t.name === 'echo')).toBeDefined();
    // Case-insensitive scheme: the resolver must have received the raw token only.
    const [, plain] = resolveOrgFromTokenMock.mock.calls[0];
    expect(plain).toBe('sgps_demo_token_abcdef0123456789abcdef0123456789abcd');
  });

  it('threads the resolved organization_id into the scope builder (cross-org isolation)', async () => {
    resolveOrgFromTokenMock.mockReset();

    const gatewayHandlerMod = await import('@/lib/mcp/gateway-handler');
    const seen: string[] = [];
    const probeHandler = gatewayHandlerMod.buildGatewayHandler(
      async (_req, organizationId) => {
        seen.push(organizationId);
        return { kind: 'org', organization_id: organizationId };
      },
    );

    resolveOrgFromTokenMock.mockResolvedValueOnce({ organization_id: ORG_A });
    const resA = await probeHandler(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: 'Bearer token-for-org-a',
        },
        body: JSON.stringify(toolsListBody),
      }),
    );
    expect(resA.status).toBe(200);

    resolveOrgFromTokenMock.mockResolvedValueOnce({ organization_id: ORG_B });
    const resB = await probeHandler(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: 'Bearer token-for-org-b',
        },
        body: JSON.stringify(toolsListBody),
      }),
    );
    expect(resB.status).toBe(200);

    // Each request compiled a scope for its own org — no leakage.
    expect(seen).toEqual([ORG_A, ORG_B]);
  });
});
