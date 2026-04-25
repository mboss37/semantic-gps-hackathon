import { createServiceClient } from '@/lib/supabase/service';

export type PolicyDecision = {
  policy_name: string;
  decision: 'allow' | 'block' | 'redact';
  mode: 'shadow' | 'enforce';
  reason?: string;
};

export type McpEventStatus =
  | 'ok'
  | 'blocked_by_policy'
  | 'origin_error'
  | 'fallback_triggered'
  | 'rollback_executed'
  | 'invalid_input'
  | 'unauthorized';

export type McpEvent = {
  // Sprint 29: trace_id can be supplied by the caller via `?trace_id=<uuid>`
  // on the gateway URL — every MCP call from a single Playground (or any
  // batched) run shares the same trace_id, so the audit page filters all of
  // them with one click. Ad-hoc callers (Claude Desktop, Inspector, customer
  // agents) don't pass it; the gateway falls back to a fresh per-request
  // UUID so each tool call still has a unique audit row.
  trace_id: string;
  // Sprint 15 K.1: scope identity for every event. Nullable because the
  // gateway logs auth-level events before a scope resolves (missing bearer,
  // invalid token, upstream db error) — those rows genuinely have no org.
  // Every post-auth writer MUST thread the authenticated org id from the
  // resolved scope; V2 (RLS) narrows this to NOT NULL.
  organization_id?: string | null;
  server_id?: string | null;
  tool_name?: string | null;
  method: string;
  policy_decisions?: PolicyDecision[];
  status: McpEventStatus;
  latency_ms?: number;
  payload?: unknown;
};

const SECRET_KEY_RE = /(authorization|api[_-]?key|secret|token|password|cookie|bearer)/i;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._\-+=/]+/gi;
const LONG_TOKEN_RE = /\b(sk-|sb_secret_|sb_publishable_|xox[baprs]-|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_\-]{16,}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export const redactPayload = (input: unknown, depth = 0): unknown => {
  if (depth > 6) return '[redacted:depth]';
  if (input == null) return input;
  if (typeof input === 'string') {
    return input
      .replace(BEARER_RE, '$1 [redacted]')
      .replace(LONG_TOKEN_RE, '[redacted:token]')
      .replace(JWT_RE, '[redacted:jwt]');
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((v) => redactPayload(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = redactPayload(v, depth + 1);
  }
  return out;
};

export const logMCPEvent = (event: McpEvent): void => {
  // Skip when Supabase isn't wired (tests, cold CLI scripts). Audit is
  // fire-and-forget — never block the gateway response on logging.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return;
  }

  const row = {
    trace_id: event.trace_id,
    organization_id: event.organization_id ?? null,
    server_id: event.server_id ?? null,
    tool_name: event.tool_name ?? null,
    method: event.method,
    policy_decisions: event.policy_decisions ?? [],
    status: event.status,
    latency_ms: event.latency_ms ?? null,
    payload_redacted: event.payload === undefined ? null : redactPayload(event.payload),
  };

  const client = createServiceClient();
  void client
    .from('mcp_events')
    .insert(row)
    .then(({ error }) => {
      if (error) {
        console.error('[audit] insert failed', { method: event.method, err: error.message });
      }
    });
};
