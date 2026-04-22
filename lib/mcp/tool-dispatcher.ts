import type { Manifest, ServerRow, ToolRow } from '@/lib/manifest/cache';
import { proxyHttp } from '@/lib/mcp/proxy-http';
import { proxyOpenApi } from '@/lib/mcp/proxy-openapi';
import { proxySalesforce } from '@/lib/mcp/proxy-salesforce';

// Tool dispatcher. Two codepaths:
//   - mockExecuteTool — canned PII-rich data keyed by tool name. Fallback only
//     when the dispatcher can't route to a real proxy: unknown server, unknown
//     tool row, or a transport value we don't recognize.
//   - executeTool — default path. Branches on the server's transport
//     (openapi / http-streamable) and dispatches to the real proxy. An
//     explicit `REAL_PROXY_ENABLED=0` opt-out still forces the mock — useful
//     for vitest files that need deterministic canned data.

const DEMO_CUSTOMER = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Jane Doe',
  email: 'jane.doe@acme.example',
  phone: '555-867-5309',
  ssn: '123-45-6789',
  address: '42 Example St, Oakland CA 94607',
} as const;

export const mockExecuteTool = (toolName: string, args: Record<string, unknown>): unknown => {
  const lowered = toolName.toLowerCase();

  if (lowered.includes('searchcustomer')) {
    return {
      customers: [
        DEMO_CUSTOMER,
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'John Smith',
          email: 'john.smith@acme.example',
          phone: '555-111-2222',
        },
      ],
    };
  }

  if (lowered.includes('customer') && (lowered.includes('order') || lowered.includes('listcustomer'))) {
    return {
      customerId: args.customerId ?? DEMO_CUSTOMER.id,
      orders: [
        { id: 'ord_001', placed_at: '2026-04-15T14:22:00Z', total_usd: 42.0 },
        { id: 'ord_002', placed_at: '2026-04-19T09:05:00Z', total_usd: 128.5 },
      ],
    };
  }

  if (lowered.includes('customer')) {
    return DEMO_CUSTOMER;
  }

  if (lowered.includes('ticket')) {
    return {
      ticket_id: 'tkt_abc123',
      status: 'open',
      customerId: args.customerId ?? DEMO_CUSTOMER.id,
      opened_by: 'demo@semantic-gps.dev',
    };
  }

  if (lowered.includes('email') || lowered.includes('send')) {
    return {
      sent: true,
      message_id: 'msg_abc123',
      to: args.to ?? DEMO_CUSTOMER.email,
      preview: 'Your order has been confirmed…',
    };
  }

  return { ok: true, tool: toolName, args };
};

export type ToolCatalogEntry = {
  source: 'builtin' | 'manifest';
  tool_id: string;
  server_id: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const ECHO_ENTRY: ToolCatalogEntry = {
  source: 'builtin',
  tool_id: 'builtin:echo',
  server_id: 'builtin',
  name: 'echo',
  description: 'Echoes the provided message back. Used to verify the gateway is alive.',
  input_schema: {
    type: 'object',
    properties: { message: { type: 'string', minLength: 1, description: 'Text to echo back' } },
    required: ['message'],
  },
};

export const buildCatalog = (manifest: Manifest): ToolCatalogEntry[] => {
  const fromManifest: ToolCatalogEntry[] = manifest.tools.map((t: ToolRow) => ({
    source: 'manifest',
    tool_id: t.id,
    server_id: t.server_id,
    name: t.name,
    description: t.description ?? '',
    input_schema: (t.input_schema as Record<string, unknown>) ?? { type: 'object' },
  }));
  return [ECHO_ENTRY, ...fromManifest];
};

export type ExecuteContext = {
  traceId: string;
};

// Real proxies are now the default path. Setting `REAL_PROXY_ENABLED=0`
// explicitly forces the mock — useful for vitest files that want canned data
// without spinning up an upstream. Any other value (or unset) routes live.
export const isRealProxyEnabled = (): boolean => process.env.REAL_PROXY_ENABLED !== '0';

export type ExecuteOk = { ok: true; result: unknown; upstreamLatencyMs?: number };
export type ExecuteErr = { ok: false; result: unknown; upstreamLatencyMs?: number; error: string; status?: number };
export type ExecuteResult = ExecuteOk | ExecuteErr;

// Unified execution path. Real proxies always dispatch based on the server's
// transport. `mockExecuteTool` is kept as a fallback (and explicit opt-out)
// for: missing server row, missing tool row, unknown transport, or
// `REAL_PROXY_ENABLED=0`. Proxy failures surface as a typed error shape so the
// caller can still feed `result` through the post-call policy pipeline.
export const executeTool = async (
  manifest: Manifest,
  entry: ToolCatalogEntry,
  args: Record<string, unknown>,
  ctx: ExecuteContext,
): Promise<ExecuteResult> => {
  if (!isRealProxyEnabled()) {
    return { ok: true, result: mockExecuteTool(entry.name, args) };
  }

  const server: ServerRow | undefined = manifest.servers.find((s) => s.id === entry.server_id);
  const tool: ToolRow | undefined = manifest.tools.find((t) => t.id === entry.tool_id);
  if (!server || !tool) {
    console.warn('[dispatcher] missing manifest row, falling back to mock', {
      server_id: entry.server_id,
      tool_id: entry.tool_id,
    });
    return { ok: true, result: mockExecuteTool(entry.name, args) };
  }

  if (server.transport === 'openapi') {
    const result = await proxyOpenApi(tool, args, { serverId: server.id, traceId: ctx.traceId });
    if (result.ok) return { ok: true, result: result.result, upstreamLatencyMs: result.latencyMs };
    return { ok: false, result: { error: result.error, status: result.status }, error: result.error, status: result.status };
  }
  if (server.transport === 'http-streamable') {
    const result = await proxyHttp(tool, args, { serverId: server.id, traceId: ctx.traceId });
    if (result.ok) return { ok: true, result: result.result, upstreamLatencyMs: result.latencyMs };
    return { ok: false, result: { error: result.error, status: result.status }, error: result.error, status: result.status };
  }
  if (server.transport === 'salesforce') {
    const result = await proxySalesforce(tool, args, { serverId: server.id, traceId: ctx.traceId });
    if (result.ok) return { ok: true, result: result.result, upstreamLatencyMs: result.latencyMs };
    return { ok: false, result: { error: result.error, status: result.status }, error: result.error, status: result.status };
  }

  console.warn('[dispatcher] unknown transport, falling back to mock', { transport: server.transport });
  return { ok: true, result: mockExecuteTool(entry.name, args) };
};
