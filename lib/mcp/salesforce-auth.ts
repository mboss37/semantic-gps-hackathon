import { z } from 'zod';
import { decrypt } from '@/lib/crypto/encrypt';
import { createServiceClient } from '@/lib/supabase/service';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';
import type { ServerRow } from '@/lib/manifest/cache';

// Auth + token-cache seam for the Salesforce proxy. Split out of
// `proxy-salesforce.ts` so that file stays under the 400-line cap and so
// tests + future integrations can reuse `UpstreamError` + the schemas.

export const TIMEOUT_MS = 10_000;
export const TOKEN_SKEW_MS = 60_000;
export const DEFAULT_TOKEN_TTL_S = 7200;

export type SalesforceAuthConfig = {
  type: 'oauth2_client_credentials';
  login_url: string;
  client_id: string;
  client_secret: string;
};

export type TokenCacheEntry = {
  access_token: string;
  expires_at: number;
  instance_url: string;
};

export type ServerRecord = Pick<ServerRow, 'id' | 'auth_config' | 'transport'>;

export class UpstreamError extends Error {
  readonly status: number;
  readonly reason: string;
  readonly detail?: string;
  constructor(status: number, reason: string, detail?: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
    this.detail = detail;
  }
}

const EncryptedAuthSchema = z.object({ ciphertext: z.string().min(1) });

const SalesforceAuthSchema = z.object({
  type: z.literal('oauth2_client_credentials'),
  login_url: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  instance_url: z.string().url(),
  expires_in: z.number().int().positive().optional(),
});

// Module-level token cache. Single-process; every serverless cold start mints
// a fresh token. `expires_at` is the absolute epoch (ms) at which the token
// expires; we refresh when `Date.now() > expires_at - TOKEN_SKEW_MS`.
const tokenCache = new Map<string, TokenCacheEntry>();

export const __resetSalesforceTokenCacheForTests = (): void => {
  tokenCache.clear();
};

export const invalidateToken = (serverId: string): void => {
  tokenCache.delete(serverId);
};

export const decodeAuthConfig = (raw: unknown): SalesforceAuthConfig | null => {
  if (raw === null || raw === undefined) return null;
  const envelope = EncryptedAuthSchema.safeParse(raw);
  if (!envelope.success) return null;
  const plaintext = decrypt(envelope.data.ciphertext);
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }
  const auth = SalesforceAuthSchema.safeParse(parsed);
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

const mintToken = async (auth: SalesforceAuthConfig): Promise<TokenCacheEntry> => {
  const base = auth.login_url.replace(/\/+$/, '');
  const url = `${base}/services/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: auth.client_id,
    client_secret: auth.client_secret,
  });
  let res: Response;
  try {
    res = await safeFetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: body.toString(),
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new UpstreamError(502, 'network_error');
  }
  const text = await res.text();
  if (!res.ok) {
    throw new UpstreamError(res.status, 'upstream_auth_failed');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UpstreamError(502, 'upstream_auth_failed', 'token response not json');
  }
  const ok = TokenResponseSchema.safeParse(parsed);
  if (!ok.success) {
    throw new UpstreamError(502, 'upstream_auth_failed', 'token response shape');
  }
  const ttl = ok.data.expires_in ?? DEFAULT_TOKEN_TTL_S;
  return {
    access_token: ok.data.access_token,
    instance_url: ok.data.instance_url,
    expires_at: Date.now() + ttl * 1000,
  };
};

export const getAccessToken = async (
  serverId: string,
  auth: SalesforceAuthConfig,
  forceRefresh = false,
): Promise<TokenCacheEntry> => {
  if (!forceRefresh) {
    const hit = tokenCache.get(serverId);
    if (hit && Date.now() < hit.expires_at - TOKEN_SKEW_MS) {
      return hit;
    }
  }
  const fresh = await mintToken(auth);
  tokenCache.set(serverId, fresh);
  return fresh;
};
