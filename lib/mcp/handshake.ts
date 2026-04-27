import { z } from 'zod';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';

// MCP HTTP-Streamable session handshake.
//
// Per the spec, a client should `initialize`, get back an `mcp-session-id`
// header, send `notifications/initialized`, and then carry the session id on
// every subsequent request. Permissive servers (our in-process vendor MCPs,
// some third-party services) tolerate calls without this dance. Strict
// servers (MuleSoft Anypoint MCP, anything built on the spec-aligned SDK
// session middleware) reject anything sent without a valid session id with
// HTTP 200 + an empty SSE body, which our parser then can't make sense of.
//
// `runMcpHandshake` always tries the dance and returns the captured session
// id when present. On any failure (network error, JSON-RPC error from the
// init call, missing session header, parse failure) it returns
// `sessionId: null` so callers can fall back to direct calls. Net effect:
// strict servers start working, permissive servers behave exactly as before.

const InitializeResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z
    .object({
      protocolVersion: z.string().optional(),
      capabilities: z.unknown().optional(),
      serverInfo: z.unknown().optional(),
    })
    .optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

const PROTOCOL_VERSION = '2025-03-26';

export type HandshakeResult = {
  sessionId: string | null;
};

const parseJsonOrSse = (text: string, contentType: string): unknown => {
  if (contentType.includes('text/event-stream')) {
    const match = text.match(/data:\s*(\{[\s\S]*?\})\s*$/m);
    if (!match) throw new Error('sse_no_data_event');
    return JSON.parse(match[1]);
  }
  return JSON.parse(text);
};

export const runMcpHandshake = async (
  originUrl: string,
  baseHeaders: Record<string, string>,
  timeoutMs = 10_000,
): Promise<HandshakeResult> => {
  let res: Response;
  try {
    res = await safeFetch(originUrl, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'semantic-gps', version: '1.0' },
        },
      }),
      timeoutMs,
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    return { sessionId: null };
  }

  if (!res.ok) {
    await res.text().catch(() => '');
    return { sessionId: null };
  }

  const sessionId = res.headers.get('mcp-session-id');

  // Drain the body so the upstream connection releases cleanly. We also
  // peek at the JSON-RPC payload: if init responded with an error we treat
  // the server as not supporting handshake and fall through to direct calls.
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const parsed = InitializeResponseSchema.safeParse(
        parseJsonOrSse(text, res.headers.get('content-type') ?? ''),
      );
      if (parsed.success && parsed.data.error) return { sessionId: null };
    } catch {
      // unparseable body is fine, we only care about the session id header
    }
  }

  if (!sessionId) return { sessionId: null };

  // Spec-mandated notification. Some strict servers (Mule) wait for it
  // before serving any further methods. Failure here is non-fatal, callers
  // still get the session id and can proceed.
  try {
    await safeFetch(originUrl, {
      method: 'POST',
      headers: { ...baseHeaders, 'mcp-session-id': sessionId },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      }),
      timeoutMs,
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    // Any other error: ignore, we still have a usable session id.
  }

  return { sessionId };
};
