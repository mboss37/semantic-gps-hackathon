import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/mcp/route';

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const PROTOCOL_VERSION = '2025-06-18';

const rpc = async (body: unknown, sessionId?: string): Promise<Response> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const request = new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return POST(request);
};

const readJson = async (res: Response): Promise<JsonRpcResponse> => {
  const text = await res.text();
  // Transport may reply as SSE ("event: message\ndata: {...}") — unwrap if so.
  const sseMatch = text.match(/data:\s*(\{[\s\S]*\})/);
  const payload = sseMatch ? sseMatch[1] : text;
  return JSON.parse(payload) as JsonRpcResponse;
};

describe('mcp gateway /api/mcp', () => {
  it('answers initialize with protocol version + echo capability', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'vitest', version: '0.0.0' },
      },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    expect(body.result?.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(body.result?.serverInfo).toMatchObject({ name: 'semantic-gps-gateway' });
    expect(body.result?.capabilities).toHaveProperty('tools');
  });

  it('lists the echo tool', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    const tools = body.result?.tools as Array<{ name: string; description?: string }> | undefined;
    expect(tools).toBeDefined();
    const echo = tools?.find((t) => t.name === 'echo');
    expect(echo).toBeDefined();
    expect(echo?.description).toMatch(/echo/i);
  });

  it('calls echo and gets the message back', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'hello gateway' },
      },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.error).toBeUndefined();
    const content = body.result?.content as Array<{ type: string; text: string }> | undefined;
    expect(content?.[0]?.text).toBe('hello gateway');
  });

  it('rejects unknown tools with a tool error result', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'does_not_exist', arguments: {} },
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    // MCP SDK returns a tool-level error (isError:true) rather than a JSON-RPC error.
    const result = body.result as { isError?: boolean; content?: Array<{ text: string }> } | undefined;
    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text ?? '').toMatch(/not found|unknown/i);
  });
});
