import { z } from 'zod';
import { runMcpHandshake } from '@/lib/mcp/handshake';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';

const McpToolSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});

const McpListResponse = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z
    .object({
      tools: z.array(McpToolSchema),
    })
    .optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

export type DiscoveredTool = z.infer<typeof McpToolSchema>;

export type DiscoverAuth = { type: 'none' } | { type: 'bearer'; token: string };

export type DiscoverResult =
  | { ok: true; tools: DiscoveredTool[] }
  | { ok: false; error: string };

// HTTP-Streamable MCP servers may reply as either plain JSON or a single SSE
// event. Parse both shapes, anything else is a protocol violation.
const parseBody = (text: string, contentType: string): unknown => {
  if (contentType.includes('text/event-stream')) {
    const match = text.match(/data:\s*(\{[\s\S]*?\})\s*$/m);
    if (!match) throw new Error('SSE response had no data event');
    return JSON.parse(match[1]);
  }
  return JSON.parse(text);
};

export const discoverTools = async (
  originUrl: string,
  auth: DiscoverAuth = { type: 'none' },
): Promise<DiscoverResult> => {
  try {
    const baseHeaders: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    if (auth.type === 'bearer') {
      baseHeaders.authorization = `Bearer ${auth.token}`;
    }

    // MCP spec handshake. Strict servers (e.g. MuleSoft Anypoint MCP) reject
    // any method before `initialize` with HTTP 200 + an empty SSE body that
    // our parser can't make sense of. Permissive servers either don't issue a
    // session id or accept calls without it; either path returns sessionId:
    // null and we fall through to a direct tools/list call as before.
    const { sessionId } = await runMcpHandshake(originUrl, baseHeaders);

    const headers = sessionId
      ? { ...baseHeaders, 'mcp-session-id': sessionId }
      : baseHeaders;

    const res = await safeFetch(originUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      timeoutMs: 10_000,
    });

    if (!res.ok) {
      return { ok: false, error: `origin returned HTTP ${res.status}` };
    }

    const text = await res.text();
    const body = parseBody(text, res.headers.get('content-type') ?? '');
    const parsed = McpListResponse.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: 'origin response is not valid MCP tools/list' };
    }
    if (parsed.data.error) {
      return { ok: false, error: `origin JSON-RPC error: ${parsed.data.error.message}` };
    }
    return { ok: true, tools: parsed.data.result?.tools ?? [] };
  } catch (e) {
    if (e instanceof SsrfBlockedError) {
      return { ok: false, error: `URL rejected by SSRF guard: ${e.code}` };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'discovery failed' };
  }
};
