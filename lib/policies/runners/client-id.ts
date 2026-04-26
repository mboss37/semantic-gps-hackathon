// client_id, require a caller-supplied client identifier in a configurable
// header and verify it's in an explicit allowlist. Empty allowlist denies so
// a misconfigured policy can't accidentally grant access.

import { getHeader, type PreCallVerdict } from './shared';

export type ClientIdConfig = {
  allowed_ids?: string[];
  header_name?: string;
};

export const runClientId = (
  headers: Record<string, string> | undefined,
  config?: ClientIdConfig,
): PreCallVerdict => {
  const headerName = config?.header_name ?? 'x-client-id';
  const id = getHeader(headers, headerName);
  if (!id) return { ok: false, reason: 'client_id_missing' };
  const allowed = config?.allowed_ids ?? [];
  if (allowed.length === 0) return { ok: false, reason: 'client_id_allowlist_empty' };
  if (!allowed.includes(id)) return { ok: false, reason: 'client_id_not_allowed' };
  return { ok: true };
};
