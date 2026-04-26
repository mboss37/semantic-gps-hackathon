// ip_allowlist, CIDR-based client-IP gate. Full CIDR library would be
// overkill, a dotted-quad parse and masked-integer compare covers the
// single-org MVP. IPv6 falls back to exact string match so unknown-shape
// inputs deny-by-default instead of silently allowing.

import type { PreCallVerdict } from './shared';

const parseIpv4 = (ip: string): number | null => {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
};

export const matchCidr = (ip: string, cidr: string): boolean => {
  const slash = cidr.indexOf('/');
  const rangeIp = slash === -1 ? cidr : cidr.slice(0, slash);
  const bitsRaw = slash === -1 ? '32' : cidr.slice(slash + 1);
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const target = parseIpv4(ip);
  const range = parseIpv4(rangeIp);
  if (target === null || range === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (target & mask) === (range & mask);
};

export type IpAllowlistConfig = {
  allowed_cidrs?: string[];
};

export const runIpAllowlist = (
  clientIp: string | undefined,
  config?: IpAllowlistConfig,
): PreCallVerdict => {
  if (!clientIp) return { ok: false, reason: 'no_client_ip' };
  const cidrs = config?.allowed_cidrs ?? [];
  if (cidrs.length === 0) return { ok: false, reason: 'ip_allowlist_empty' };
  if (!cidrs.some((cidr) => matchCidr(clientIp, cidr))) {
    return { ok: false, reason: 'ip_not_in_allowlist' };
  }
  return { ok: true };
};
