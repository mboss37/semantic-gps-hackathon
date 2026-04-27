import { runMcpHandshake, type HandshakeResult } from '@/lib/mcp/handshake';

// Per-execution handshake memoization.
//
// A single `execute_route` saga can fan out 5+ tool calls against the same
// upstream MCP server, and each one would otherwise drive a fresh
// `initialize → mcp-session-id → notifications/initialized` round trip
// against that origin. The session id captured by the first handshake is
// valid for the rest of the saga, so we cache the in-flight Promise
// keyed on origin URL and let every subsequent step reuse it.
//
// Lifecycle: the cache is created at the start of an `executeRoute` (and
// shared with `executeRollback` so compensators on the same upstreams
// reuse the captured session). It is dropped at the end of the route -
// stale session ids do not leak across requests, and there is no
// cross-tenant concern because each request handler creates a fresh
// instance. SsrfBlockedError still propagates - cached failures are NOT
// swallowed, the rejected promise re-throws on every reuse so callers
// can surface the right error code without bouncing on a poisoned cache.

export type HandshakeCache = Map<string, Promise<HandshakeResult>>;

export const createHandshakeCache = (): HandshakeCache => new Map();

export const getOrRunHandshake = (
  cache: HandshakeCache,
  originUrl: string,
  baseHeaders: Record<string, string>,
  timeoutMs?: number,
): Promise<HandshakeResult> => {
  const cached = cache.get(originUrl);
  if (cached) return cached;
  const inflight = runMcpHandshake(originUrl, baseHeaders, timeoutMs);
  // Attach a no-op rejection handler synchronously so a rejection that
  // settles before the caller awaits the cached promise is never reported
  // as "unhandled" by the runtime. The returned `inflight` still rejects
  // normally for every awaiter — `.catch` returns a NEW chained promise,
  // it does not consume or transform the original.
  inflight.catch(() => {});
  cache.set(originUrl, inflight);
  return inflight;
};
