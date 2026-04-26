import { z } from 'zod';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import { VendorError } from '@/lib/mcp/vendors/errors';

// Slack MCP vendor seam. Owns Bot Token REST dispatch for the 4 curated Slack
// tools. `SLACK_BOT_TOKEN` comes from the env var, tokens don't auto-refresh
// so no cache or mint flow. Colocated with the gateway today; extraction to a
// standalone deploy is a zero-gateway-change refactor.

const TIMEOUT_MS = 10_000;
const SLACK_API_BASE = 'https://slack.com/api';

// Slack: every response is `{ok: boolean, ...}`. HTTP 200 with `{ok:false}` is
// an app-level error, surface with `error` as detail so callers can tell
// `channel_not_found` from generic 4xx.
const SlackEnvelopeSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

type SlackCallResult = { body: Record<string, unknown> };

const loadBotToken = (): string | null => {
  const token = process.env.SLACK_BOT_TOKEN ?? '';
  return token || null;
};

const slackCall = async (
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<SlackCallResult> => {
  const url = `${SLACK_API_BASE}/${method}`;
  const init: RequestInit & { timeoutMs?: number } = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${botToken}`,
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
    throw new VendorError(502, 'network_error');
  }

  const text = await res.text();
  if (!res.ok) throw new VendorError(res.status, 'origin_error');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new VendorError(502, 'parse_error');
  }

  const envelope = SlackEnvelopeSchema.safeParse(parsed);
  if (!envelope.success || typeof parsed !== 'object' || parsed === null) {
    throw new VendorError(502, 'parse_error', 'slack response shape');
  }
  if (!envelope.data.ok) {
    throw new VendorError(400, 'origin_error', envelope.data.error ?? 'unknown_slack_error');
  }

  return { body: parsed as Record<string, unknown> };
};

// Per-tool input schemas.
const UsersLookupArgs = z.object({ email: z.string().email().max(200) });
const ChatPostMessageArgs = z.object({
  channel: z.string().min(1).max(200),
  text: z.string().min(1).max(4000),
});
const ConversationsListArgs = z.object({
  types: z.string().max(200).optional(),
  limit: z.number().int().positive().max(1000).optional(),
});
const DeleteMessageArgs = z.object({
  channel: z.string().min(1).max(200),
  ts: z.string().min(1).max(64),
});

// Project verbose Slack user objects down to the 5 fields callers need.
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

export const SLACK_TOOLS = [
  {
    name: 'users_lookup_by_email',
    description: 'Find a Slack user by email address.',
    inputSchema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    },
  },
  {
    name: 'chat_post_message',
    description: 'Post a message to a Slack channel or DM.',
    inputSchema: {
      type: 'object',
      required: ['channel', 'text'],
      properties: {
        text: { type: 'string', minLength: 1 },
        channel: { type: 'string', minLength: 1 },
      },
    },
  },
  {
    name: 'conversations_list',
    description: 'List Slack channels the bot has access to.',
    inputSchema: {
      type: 'object',
      required: [],
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 1000 },
        types: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_message',
    description: 'Delete a previously-posted Slack message. Compensator for chat_post_message on saga rollback.',
    inputSchema: {
      type: 'object',
      required: ['channel', 'ts'],
      properties: {
        channel: { type: 'string', minLength: 1 },
        ts: { type: 'string', minLength: 1 },
      },
    },
  },
] as const;

export const dispatchSlackTool = async (
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const botToken = loadBotToken();
  if (!botToken) throw new VendorError(500, 'credentials_missing');

  if (toolName === 'users_lookup_by_email') {
    const parsed = UsersLookupArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await slackCall(botToken, 'users.lookupByEmail', { email: parsed.data.email });
    return projectUser(body);
  }

  if (toolName === 'chat_post_message') {
    const parsed = ChatPostMessageArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await slackCall(botToken, 'chat.postMessage', {
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
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await slackCall(botToken, 'conversations.list', {
      types: parsed.data.types ?? 'public_channel',
      limit: parsed.data.limit ?? 100,
    });
    return projectChannels(body);
  }

  if (toolName === 'delete_message') {
    const parsed = DeleteMessageArgs.safeParse(args);
    if (!parsed.success) throw new VendorError(400, 'invalid_input');
    const { body } = await slackCall(botToken, 'chat.delete', {
      channel: parsed.data.channel,
      ts: parsed.data.ts,
    });
    return {
      ok: body.ok ?? true,
      channel: body.channel ?? parsed.data.channel,
      ts: body.ts ?? parsed.data.ts,
    };
  }

  throw new VendorError(400, 'unknown_tool');
};
