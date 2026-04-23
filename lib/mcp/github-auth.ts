import { z } from 'zod';
import { decrypt } from '@/lib/crypto/encrypt';
import { createServiceClient } from '@/lib/supabase/service';
import type { ServerRow } from '@/lib/manifest/cache';
import { UpstreamError } from '@/lib/mcp/upstream-error';

// Auth seam for the GitHub proxy. Simpler than the Salesforce version — PATs
// (both classic and fine-grained) don't auto-refresh, so there's no mint flow
// and no token cache. The `type` discriminator leaves room for GitHub App
// installation-token OAuth later without breaking the schema.
//
// UpstreamError is re-exported so proxy-github.ts + tests import from a single
// module; canonical definition lives in `./upstream-error`.

export const TIMEOUT_MS = 10_000;

export type GithubAuthConfig = {
  type: 'pat';
  pat: string;
};

export type ServerRecord = Pick<ServerRow, 'id' | 'auth_config' | 'transport'>;

export { UpstreamError };

const EncryptedAuthSchema = z.object({ ciphertext: z.string().min(1) });

const GithubAuthSchema = z.object({
  type: z.literal('pat'),
  pat: z.string().min(1),
});

export const decodeGithubAuthConfig = (raw: unknown): GithubAuthConfig | null => {
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
  const auth = GithubAuthSchema.safeParse(parsed);
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
