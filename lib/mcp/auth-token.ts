import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Gateway bearer-token auth. Tokens are opaque secrets the client passes
// as `Authorization: Bearer <tok>`. DB stores only the SHA-256 hash, so a
// read of `gateway_tokens` never leaks plaintext. Lookup is by hash.

export const hashToken = (plain: string): string =>
  createHash('sha256').update(plain).digest('hex');

// Case-insensitive scheme per RFC 7235. Returns null on missing header,
// wrong scheme, or empty token so callers can respond with a single 401.
export const parseBearer = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  const match = /^bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
};

// Discriminated result so the gateway can distinguish "no matching token"
// from "couldn't reach the DB", these produce different JSON-RPC errors
// at the client (one is an auth problem, the other is a server problem).
export type ResolveTokenResult =
  | { ok: true; organization_id: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'db_error'; detail: string };

// Fire-and-forget `last_used_at` bump on hit, surfaces rotation candidates
// without blocking the gateway response.
export const resolveOrgFromToken = async (
  supabase: SupabaseClient,
  plain: string,
): Promise<ResolveTokenResult> => {
  const hash = hashToken(plain);
  const { data, error } = await supabase
    .from('gateway_tokens')
    .select('id, organization_id')
    .eq('token_hash', hash)
    .maybeSingle();
  if (error) return { ok: false, reason: 'db_error', detail: error.message };
  if (!data?.organization_id) return { ok: false, reason: 'not_found' };

  void supabase
    .from('gateway_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: bumpErr }) => {
      if (bumpErr) {
        console.error('[auth-token] last_used_at bump failed', bumpErr.message);
      }
    });

  return { ok: true, organization_id: data.organization_id };
};
