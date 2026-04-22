import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// SSRF guard. Every outbound fetch on user-supplied URLs routes through here.
// Blocks: non-http(s), localhost names, and resolved IPs in:
//   127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
//   169.254.0.0/16 (link-local incl. cloud metadata), 0.0.0.0/8,
//   IPv6 loopback (::1), IPv6 ULA (fc00::/7), IPv6 link-local (fe80::/10),
//   IPv4-mapped IPv6 variants of all of the above.

const DEFAULT_TIMEOUT_MS = 10_000;

export class SsrfBlockedError extends Error {
  readonly code: 'bad_scheme' | 'bad_host' | 'private_ip' | 'dns_failed';
  constructor(code: SsrfBlockedError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'SsrfBlockedError';
  }
}

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
};

const isBlockedIPv4 = (ip: string): boolean => {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  const inRange = (cidrIp: string, bits: number) => {
    const base = ipv4ToInt(cidrIp);
    if (base === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (base & mask);
  };
  return (
    inRange('0.0.0.0', 8) ||
    inRange('10.0.0.0', 8) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.168.0.0', 16) ||
    inRange('100.64.0.0', 10)
  );
};

const isBlockedIPv6 = (ip: string): boolean => {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
};

const isBlockedIp = (ip: string): boolean => {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true;
};

export const validateUrl = async (input: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SsrfBlockedError('bad_host', 'invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfBlockedError('bad_scheme', `scheme ${url.protocol} not allowed`);
  }

  // Test-only escape hatch — lets proxy tests spin `http.createServer` on
  // an ephemeral localhost port without tripping the loopback guard.
  // Never set this in production; there is no code path outside tests that
  // sets it, and SSRF is a hard requirement for the gateway route.
  const allowLocalhost = process.env.SSRF_ALLOW_LOCALHOST === '1';

  const host = url.hostname.toLowerCase();
  if (!host || ((host === 'localhost' || host.endsWith('.localhost')) && !allowLocalhost)) {
    throw new SsrfBlockedError('bad_host', 'localhost rejected');
  }

  if (isIP(host)) {
    if (isBlockedIp(host) && !allowLocalhost) {
      throw new SsrfBlockedError('private_ip', 'ip in blocked range');
    }
    return url;
  }

  try {
    const records = await lookup(host, { all: true });
    if (records.length === 0) {
      throw new SsrfBlockedError('dns_failed', `no dns records for ${host}`);
    }
    for (const r of records) {
      if (isBlockedIp(r.address) && !allowLocalhost) {
        throw new SsrfBlockedError('private_ip', `${host} resolves to blocked ${r.address}`);
      }
    }
  } catch (e) {
    if (e instanceof SsrfBlockedError) throw e;
    throw new SsrfBlockedError('dns_failed', e instanceof Error ? e.message : 'dns lookup failed');
  }

  return url;
};

type FetchInit = RequestInit & { timeoutMs?: number };

export const fetchWithTimeout = async (url: string | URL, init: FetchInit = {}): Promise<Response> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: inputSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort((inputSignal as AbortSignal).reason);
  if (inputSignal) {
    if (inputSignal.aborted) controller.abort(inputSignal.reason);
    else inputSignal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (inputSignal) inputSignal.removeEventListener('abort', onAbort);
  }
};

export const safeFetch = async (input: string, init: FetchInit = {}): Promise<Response> => {
  const validated = await validateUrl(input);
  return fetchWithTimeout(validated, init);
};
