// Shared auth-config decoder for server origins. Extracted from
// `lib/servers/fetch.ts` so route handlers (e.g. /api/servers/[id]/rediscover)
// can reuse the encrypted-envelope + legacy-plaintext handling without
// duplicating the decrypt/parse logic.

import { z } from 'zod';
import { decrypt } from '@/lib/crypto/encrypt';

export const EncryptedAuthSchema = z.object({ ciphertext: z.string().min(1) });

export const AuthConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().min(1) }),
]);

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const decodeAuthConfig = (raw: unknown): AuthConfig => {
  if (raw === null || raw === undefined) return { type: 'none' };
  const envelope = EncryptedAuthSchema.safeParse(raw);
  if (!envelope.success) {
    // Legacy plaintext fallback — never stored in prod but keeps tests simple.
    const plain = AuthConfigSchema.safeParse(raw);
    return plain.success ? plain.data : { type: 'none' };
  }
  try {
    const plaintext = decrypt(envelope.data.ciphertext);
    const parsed: unknown = JSON.parse(plaintext);
    const auth = AuthConfigSchema.safeParse(parsed);
    return auth.success ? auth.data : { type: 'none' };
  } catch {
    return { type: 'none' };
  }
};
