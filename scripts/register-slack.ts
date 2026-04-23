import type { SupabaseClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/crypto/encrypt';
import type { SlackAuthConfig } from '@/lib/mcp/proxy-slack';

// Importable helper — NOT a CLI runner. Invoked from J.3 (and the dev
// console during demo setup) to register the hero Slack server + its 3
// curated tools. Credentials are encrypted via the same AES-GCM envelope used
// by `/api/servers` so the manifest cache decode path is identical.

type Args = {
  organization_id: string;
  credentials: SlackAuthConfig;
  // Optional domain binding so the server shows up under the right scoped
  // gateway (e.g. SalesOps). J.3 resolves the domain_id before calling.
  domain_id?: string | null;
  // Optional name override — defaults to "Demo Slack" so the dashboard
  // row is recognizable at a glance.
  name?: string;
  // Optional default channel for `chat_post_message` — not stored on the
  // server row (tool args are per-call), but accepted for symmetry with
  // the Salesforce registrar and to unblock demo-seed helpers.
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
];

export const registerSlackServer = async (
  supabase: SupabaseClient,
  { organization_id, credentials, domain_id = null, name = 'Demo Slack' }: Args,
): Promise<string> => {
  const auth_config = { ciphertext: encrypt(JSON.stringify(credentials)) };

  const { data: server, error: serverErr } = await supabase
    .from('servers')
    .insert({
      organization_id,
      domain_id,
      name,
      origin_url: 'https://slack.com/api',
      transport: 'slack',
      auth_config,
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
