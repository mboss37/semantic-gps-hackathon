import { z } from 'zod';
import type { ToolRow } from '@/lib/manifest/cache';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import {
  decodeSlackAuthConfig,
  loadServer,
  TIMEOUT_MS,
  UpstreamError,
  type SlackAuthConfig,
} from '@/lib/mcp/slack-auth';

// Re-export auth surface so external callers (tool-dispatcher, tests,
// register-slack) keep a single import path.
export { type SlackAuthConfig } from '@/lib/mcp/slack-auth';

// Slack proxy — hand-authored mapping from 3 curated MCP tools onto Slack Web
// API methods. Bot Token only (Sprint 8 scope); no token cache because
// `xoxb-...` tokens don't expire. Same ProxyResult contract as proxy-openapi /
// proxy-http / proxy-salesforce so the dispatcher switch routes without
// special casing.

const SLACK_API_BASE = 'https://slack.com/api';

export type ProxyOk = { ok: true; result: unknown; latencyMs: number };
export type ProxyErr = { ok: false; error: string; status?: number };
export type ProxyResult = ProxyOk | ProxyErr;

export type ProxyContext = {
  serverId: string;
  traceId: string;
};

// Slack API idiom: every response includes `{ok: boolean, ...}`. HTTP 200 with
// `{ok: false, error: "..."}` is an application-level error (bad channel,
// missing scope, etc.). Propagate as origin_error with the Slack error code
// as detail so callers can distinguish `channel_not_found` from generic 4xx.
const SlackEnvelopeSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

type SlackCallResult = { body: Record<string, unknown> };

// Generic Slack Web API call. All three tools use POST + JSON body — Slack
// accepts this uniformly when `Authorization: Bearer` is set, so the dispatch
// layer stays flat. Slack requires the `charset=utf-8` content-type suffix
// when POSTing JSON.
const slackCall = async (
  auth: SlackAuthConfig,
  method: string,
  body: Record<string, unknown>,
): Promise<SlackCallResult> => {
  const url = `${SLACK_API_BASE}/${method}`;
  const init: RequestInit & { timeoutMs?: number } = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.bot_token}`,
      'content-type': 'application/json; charset=utf-8',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
    timeoutMs: TIMEOUT_MS,
  };

  let res: Response;
  try {
    res = await safeFetch(url, init);
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new UpstreamError(502, 'network_error');
  }

  const text = await res.text();
  if (!res.ok) {
    throw new UpstreamError(res.status, 'origin_error');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UpstreamError(502, 'parse_error');
  }

  const envelope = SlackEnvelopeSchema.safeParse(parsed);
  if (!envelope.success || typeof parsed !== 'object' || parsed === null) {
    throw new UpstreamError(502, 'parse_error', 'slack response shape');
  }
  if (!envelope.data.ok) {
    throw new UpstreamError(400, 'origin_error', envelope.data.error ?? 'unknown_slack_error');
  }

  return { body: parsed as Record<string, unknown> };
};

// Per-tool input schemas. Enforced locally so we never hit Slack with
// malformed input. Errors here become `invalid_input` before any fetch.
const UsersLookupArgs = z.object({ email: z.string().email().max(200) });
const ChatPostMessageArgs = z.object({
  channel: z.string().min(1).max(200),
  text: z.string().min(1).max(4000),
});
const ConversationsListArgs = z.object({
  types: z.string().max(200).optional(),
  limit: z.number().int().positive().max(1000).optional(),
});
// Compensator for chat_post_message (WP-12.2 / G.17). Slack message timestamps
// are floating-point strings like "1699999999.123456"; we only validate length
// + non-empty here and let Slack reject malformed ts upstream.
const DeleteMessageArgs = z.object({
  channel: z.string().min(1).max(200),
  ts: z.string().min(1).max(64),
});

// Project verbose Slack user objects down to the 5 fields callers actually
// need. Keeps tool output predictable for downstream policy + UI code.
type SlackUserProjection = {
  id: string | null;
  name: string | null;
  email: string | null;
  real_name: string | null;
  is_bot: boolean | null;
};

const projectUser = (body: Record<string, unknown>): SlackUserProjection => {
  const user = (body.user ?? null) as Record<string, unknown> | null;
  if (!user) return { id: null, name: null, email: null, real_name: null, is_bot: null };
  const profile = (user.profile ?? null) as Record<string, unknown> | null;
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  return {
    id: str(user.id),
    name: str(user.name),
    email: profile ? str(profile.email) : null,
    real_name: str(user.real_name) ?? (profile ? str(profile.real_name) : null),
    is_bot: bool(user.is_bot),
  };
};

type SlackChannelProjection = {
  id: string | null;
  name: string | null;
  is_channel: boolean | null;
  is_private: boolean | null;
  num_members: number | null;
};

const projectChannels = (body: Record<string, unknown>): { channels: SlackChannelProjection[] } => {
  const raw = Array.isArray(body.channels) ? body.channels : [];
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const channels = raw.map((c) => {
    const row = (c ?? {}) as Record<string, unknown>;
    return {
      id: str(row.id),
      name: str(row.name),
      is_channel: bool(row.is_channel),
      is_private: bool(row.is_private),
      num_members: num(row.num_members),
    };
  });
  return { channels };
};

const dispatchTool = async (
  auth: SlackAuthConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  if (toolName === 'users_lookup_by_email') {
    const parsed = UsersLookupArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await slackCall(auth, 'users.lookupByEmail', { email: parsed.data.email });
    return projectUser(body);
  }

  if (toolName === 'chat_post_message') {
    const parsed = ChatPostMessageArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await slackCall(auth, 'chat.postMessage', {
      channel: parsed.data.channel,
      text: parsed.data.text,
    });
    return {
      ok: body.ok ?? true,
      channel: body.channel ?? null,
      ts: body.ts ?? null,
      message: body.message ?? null,
    };
  }

  if (toolName === 'conversations_list') {
    const parsed = ConversationsListArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await slackCall(auth, 'conversations.list', {
      types: parsed.data.types ?? 'public_channel',
      limit: parsed.data.limit ?? 100,
    });
    return projectChannels(body);
  }

  if (toolName === 'delete_message') {
    const parsed = DeleteMessageArgs.safeParse(args);
    if (!parsed.success) throw new UpstreamError(400, 'invalid_input');
    const { body } = await slackCall(auth, 'chat.delete', {
      channel: parsed.data.channel,
      ts: parsed.data.ts,
    });
    return {
      ok: body.ok ?? true,
      channel: body.channel ?? parsed.data.channel,
      ts: body.ts ?? parsed.data.ts,
    };
  }

  throw new UpstreamError(400, 'unknown_tool');
};

// Public entry point for `tool-dispatcher.ts`. Same `ProxyResult` contract as
// the OpenAPI + HTTP-streamable + Salesforce proxies so the dispatcher
// transport switch stays uniform.
export const proxySlack = async (
  tool: ToolRow,
  args: Record<string, unknown>,
  ctx: ProxyContext,
): Promise<ProxyResult> => {
  const started = performance.now();

  const server = await loadServer(ctx.serverId);
  if (!server) return { ok: false, error: 'server_not_found' };
  if (server.transport !== 'slack') return { ok: false, error: 'wrong_transport' };

  let auth: SlackAuthConfig | null;
  try {
    auth = decodeSlackAuthConfig(server.auth_config);
  } catch {
    return { ok: false, error: 'auth_decode_failed' };
  }
  if (!auth) return { ok: false, error: 'auth_decode_failed' };

  try {
    const result = await dispatchTool(auth, tool.name, args);
    const latencyMs = Math.round(performance.now() - started);
    return { ok: true, result, latencyMs };
  } catch (e) {
    if (e instanceof SsrfBlockedError) return { ok: false, error: 'ssrf_blocked' };
    if (e instanceof UpstreamError) {
      return { ok: false, error: e.reason, status: e.status };
    }
    return { ok: false, error: 'network_error' };
  }
};
