import type { SupabaseClient } from '@supabase/supabase-js';

// Importable helper, NOT a CLI runner. Invoked from J.3 and demo-setup flows
// to register the Slack vendor MCP. After Sprint 15 WP-C.6 the Slack proxy
// lives as a Next.js route under `app/api/mcps/slack/route.ts`; this helper
// registers it into the gateway via the standard http-streamable transport
// path. Credentials live in env vars on the same deployment, so `auth_config`
// stays null.

type Args = {
  organization_id: string;
  // Optional domain binding so the server shows up under the right scoped
  // gateway. J.3 resolves the domain_id before calling.
  domain_id?: string | null;
  // Absolute URL of the vendor MCP route. Defaults to the co-deployed route.
  // Override for tests or a future standalone extraction.
  origin_url?: string;
  // Display name, defaults to "Demo Slack".
  name?: string;
  // Optional default channel, accepted for symmetry with the legacy register
  // signature (used by demo-seed helpers). Not persisted on the server row.
  defaultChannel?: string;
};

type ToolSeed = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const TOOL_SEEDS: ToolSeed[] = [
  {
    name: 'users_lookup_by_email',
    description: 'Look up a Slack user by exact email. Returns id, name, real_name, email, is_bot.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', description: 'User email (exact match)' },
      },
      required: ['email'],
    },
  },
  {
    name: 'chat_post_message',
    description: 'Post a text message to a Slack channel (name, channel ID, or user ID for DM).',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          minLength: 1,
          description: 'Channel name (#general), channel ID (C012345), or user ID (DM target)',
        },
        text: { type: 'string', minLength: 1, description: 'Message body (mrkdwn allowed)' },
      },
      required: ['channel', 'text'],
    },
  },
  {
    name: 'conversations_list',
    description: 'List Slack channels (default: public_channel, first 100).',
    input_schema: {
      type: 'object',
      properties: {
        types: {
          type: 'string',
          description: 'Comma-separated Slack channel types (e.g. "public_channel,private_channel")',
        },
        limit: { type: 'integer', minimum: 1, maximum: 1000, description: 'Max channels to return' },
      },
      required: [],
    },
  },
  {
    name: 'delete_message',
    description: 'Delete a previously-posted Slack message. Compensator for chat_post_message on saga rollback.',
    input_schema: {
      type: 'object',
      properties: {
        channel: { type: 'string', minLength: 1, description: 'Channel id the original message was posted in' },
        ts: { type: 'string', minLength: 1, description: 'Message ts returned by chat_post_message' },
      },
      required: ['channel', 'ts'],
    },
  },
];

const DEFAULT_ORIGIN_URL = 'http://localhost:3000/api/mcps/slack';

export const registerSlackServer = async (
  supabase: SupabaseClient,
  {
    organization_id,
    domain_id = null,
    origin_url = DEFAULT_ORIGIN_URL,
    name = 'Demo Slack',
  }: Args,
): Promise<string> => {
  const { data: server, error: serverErr } = await supabase
    .from('servers')
    .insert({
      organization_id,
      domain_id,
      name,
      origin_url,
      transport: 'http-streamable',
      auth_config: null,
    })
    .select('id')
    .single();

  if (serverErr || !server) {
    throw new Error(`register slack server failed: ${serverErr?.message ?? 'no row returned'}`);
  }

  const rows = TOOL_SEEDS.map((t) => ({
    server_id: server.id,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const { error: toolsErr } = await supabase.from('tools').insert(rows);
  if (toolsErr) {
    throw new Error(`register slack tools failed: ${toolsErr.message}`);
  }

  return server.id as string;
};
