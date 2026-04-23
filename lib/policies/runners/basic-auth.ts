// basic_auth — minimum-viable request-metadata gate. Checks only that an
// `Authorization: Basic …` header is present; credential validation is the
// upstream's job. Empty value fails closed.

import { getHeader, type PreCallVerdict } from './shared';

export type BasicAuthConfig = {
  realm?: string;
};

export const runBasicAuth = (
  headers: Record<string, string> | undefined,
): PreCallVerdict => {
  const auth = getHeader(headers, 'authorization');
  if (!auth || !auth.toLowerCase().startsWith('basic ')) {
    return { ok: false, reason: 'missing_basic_auth' };
  }
  return { ok: true };
};
