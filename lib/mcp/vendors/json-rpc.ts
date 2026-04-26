import { z } from 'zod';
import { VendorError } from '@/lib/mcp/vendors/errors';

// Minimal JSON-RPC over HTTP adapter shared by the three vendor MCP routes.
// Every route bootstraps on this module and supplies its tool catalog +
// `dispatch(name, args)` callback. Intentionally light, no manifest, no
// policy engine, no audit: these routes are pure vendor-to-REST adapters
// registered INTO the gateway via `POST /api/servers`. Governance runs at
// the gateway tier upstream, never here.
//
// Supported methods: `initialize`, `tools/list`, `tools/call`. Anything else
// returns JSON-RPC -32601 method_not_found, mirrors the main gateway's
// unknown-method behavior. The response shape matches the MCP HTTP-streamable
// contract so `proxyHttp` in `lib/mcp/proxy-http.ts` can reach these routes
// with no special casing.

export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type VendorRouteConfig = {
  // Protocol version echoed on `initialize`. MCP SDK currently handshakes on
  // 2025-03-26; we pick the caller's version when valid, else fall back here.
  protocolVersion: string;
  serverInfo: { name: string; version: string };
  tools: ReadonlyArray<ToolDescriptor>;
  dispatch: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
};

// Accept either positive JSON-RPC id (spec default) or any type; MCP clients
// occasionally send strings or null. Error responses echo id when present.
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

type JsonRpcId = string | number | null;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const rpcError = (id: JsonRpcId | undefined, code: number, message: string, data?: unknown): Response =>
  jsonResponse({
    jsonrpc: '2.0',
    id: id ?? null,
    error: data === undefined ? { code, message } : { code, message, data },
  });

const rpcResult = (id: JsonRpcId | undefined, result: unknown): Response =>
  jsonResponse({ jsonrpc: '2.0', id: id ?? null, result });

// MCP `tools/call` returns a structured content array. We wrap the dispatch
// result as a JSON text block so the main gateway's `extractResult` picks it
// up the same way it does for any other HTTP-streamable upstream.
const wrapCallResult = (result: unknown): { content: Array<{ type: 'text'; text: string }> } => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
});

export const handleVendorRpcRequest = async (
  request: Request,
  config: VendorRouteConfig,
): Promise<Response> => {
  // Only POST carries a JSON-RPC body. GET on these routes returns an empty
  // 200 so curl-based smoke tests can confirm the route exists without
  // tripping method-not-allowed, analogous to the main gateway's behavior.
  if (request.method !== 'POST') {
    return jsonResponse({ ok: true, server: config.serverInfo });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return rpcError(undefined, -32700, 'Parse error');
  }

  const parsed = JsonRpcRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return rpcError(
      undefined,
      -32600,
      'Invalid Request',
      { reason: 'invalid_jsonrpc', issues: parsed.error.flatten() },
    );
  }

  const { id, method, params } = parsed.data;

  if (method === 'initialize') {
    const protocolVersion =
      typeof params?.protocolVersion === 'string' ? params.protocolVersion : config.protocolVersion;
    return rpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: config.serverInfo,
    });
  }

  if (method === 'notifications/initialized') {
    // Notifications (no id) per JSON-RPC 2.0; MCP clients send this after
    // `initialize`. Respond 202-ish with an empty body so clients don't hang.
    return new Response(null, { status: 202 });
  }

  if (method === 'tools/list') {
    return rpcResult(id, {
      tools: config.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }

  if (method === 'tools/call') {
    const toolName = typeof params?.name === 'string' ? params.name : '';
    const args =
      (params?.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {});
    if (!toolName) {
      return rpcError(id, -32602, 'Invalid params', { reason: 'missing_tool_name' });
    }
    const known = config.tools.find((t) => t.name === toolName);
    if (!known) {
      return rpcError(id, -32602, 'Invalid params', { reason: 'unknown_tool' });
    }
    try {
      const result = await config.dispatch(toolName, args);
      return rpcResult(id, wrapCallResult(result));
    } catch (e) {
      if (e instanceof VendorError) {
        return rpcError(id, -32000, e.reason, {
          status: e.status,
          reason: e.reason,
          ...(e.detail ? { detail: e.detail } : {}),
        });
      }
      const message = e instanceof Error ? e.message : String(e);
      return rpcError(id, -32000, 'internal_error', { message });
    }
  }

  return rpcError(id, -32601, 'Method not found', { method });
};
