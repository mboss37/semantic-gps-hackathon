import { z } from 'zod';
import { decrypt } from '@/lib/crypto/encrypt';
import { createServiceClient } from '@/lib/supabase/service';
import type { ServerRow } from '@/lib/manifest/cache';
import { UpstreamError } from '@/lib/mcp/upstream-error';

// Auth seam for the Slack proxy. Deliberately minimal compared to the
// Salesforce version — Slack bot tokens (`xoxb-...`) don't expire, so there's
// no mint flow and no token cache. The `type` discriminator on the auth config
// leaves room for `xoxp` user-token OAuth later without breaking the schema.
//
// UpstreamError is re-exported so proxy-slack.ts + tests import from a single
// module; canonical definition lives in `./upstream-error`.

export const TIMEOUT_MS = 10_000;

export type SlackAuthConfig = {
  type: 'bot_token';
  bot_token: string;
};

export type ServerRecord = Pick<ServerRow, 'id' | 'auth_config' | 'transport'>;

export { UpstreamError };

const EncryptedAuthSchema = z.object({ ciphertext: z.string().min(1) });

const SlackAuthSchema = z.object({
  type: z.literal('bot_token'),
  bot_token: z.string().min(1),
});

export const decodeSlackAuthConfig = (raw: unknown): SlackAuthConfig | null => {
  if (raw === null || raw === undefined) return null;
  const envelope = EncryptedAuthSchema.safeParse(raw);
  if (!envelope.success) return null;
  let plaintext: string;
  try {
    plaintext = decrypt(envelope.data.ciphertext);
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }
  const auth = SlackAuthSchema.safeParse(parsed);
  if (!auth.success) return null;
  return auth.data;
};

export const loadServer = async (serverId: string): Promise<ServerRecord | null> => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('servers')
    .select('id, auth_config, transport')
    .eq('id', serverId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ServerRecord;
};
