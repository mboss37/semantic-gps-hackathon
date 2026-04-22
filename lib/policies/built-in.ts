// Built-in policy primitives. Pure functions — no DB, no manifest — so the
// engine layer (lib/policies/enforce.ts) can compose them against assignments
// and the test suite can exercise them with plain fixtures.

export type PiiPattern = {
  name: string;
  regex: RegExp;
  replacement: string;
};

export const DEFAULT_PII_PATTERNS: readonly PiiPattern[] = [
  {
    name: 'email',
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replacement: '[redacted:email]',
  },
  {
    name: 'phone_us',
    regex: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
    replacement: '[redacted:phone]',
  },
  {
    name: 'ssn_us',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[redacted:ssn]',
  },
  {
    // BIN-anchored so long digit runs (UUIDs-with-hex, timestamps, tracking
    // ids) don't false-positive. Covers the major networks with their
    // canonical prefixes + lengths.
    name: 'credit_card',
    regex:
      /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6011\d{12}|6221\d{12}|3(?:0[0-5]|[68]\d)\d{11}|35(?:2[89]|[3-8]\d)\d{12})\b/g,
    replacement: '[redacted:cc]',
  },
];

export type PiiRedactionConfig = {
  patterns?: Array<{ name: string; regex: string; replacement?: string }>;
};

const compilePatterns = (config?: PiiRedactionConfig): readonly PiiPattern[] => {
  if (!config?.patterns || config.patterns.length === 0) return DEFAULT_PII_PATTERNS;
  return config.patterns.map((p) => ({
    name: p.name,
    regex: new RegExp(p.regex, 'gi'),
    replacement: p.replacement ?? `[redacted:${p.name}]`,
  }));
};

export type PiiRedactionResult = {
  match_count: number;
  match_samples: string[];
  redacted: unknown;
};

const MAX_SAMPLES = 5;
const MAX_DEPTH = 8;

export const runPiiRedaction = (value: unknown, config?: PiiRedactionConfig): PiiRedactionResult => {
  const patterns = compilePatterns(config);
  const samples: string[] = [];
  let matchCount = 0;

  const walk = (v: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return v;
    if (typeof v === 'string') {
      let out = v;
      for (const pattern of patterns) {
        // Fresh regex per scan so `g` flag lastIndex state doesn't leak.
        const scanner = new RegExp(pattern.regex.source, pattern.regex.flags);
        const matches = v.match(scanner);
        if (matches && matches.length > 0) {
          matchCount += matches.length;
          if (samples.length < MAX_SAMPLES) {
            for (const m of matches) {
              if (samples.length >= MAX_SAMPLES) break;
              samples.push(`${pattern.name}:${m.slice(0, 3)}…`);
            }
          }
          out = out.replace(scanner, pattern.replacement);
        }
      }
      return out;
    }
    if (Array.isArray(v)) return v.map((item) => walk(item, depth + 1));
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(val, depth + 1);
      }
      return out;
    }
    return v;
  };

  const redacted = walk(value, 0);
  return { match_count: matchCount, match_samples: samples, redacted };
};

export type AllowlistConfig = {
  tool_names?: string[];
};

export type AllowlistVerdict =
  | { ok: true }
  | { ok: false; reason: string };

export const runAllowlist = (toolName: string, config?: AllowlistConfig): AllowlistVerdict => {
  const allowed = config?.tool_names ?? [];
  if (allowed.length === 0) return { ok: true };
  if (allowed.includes(toolName)) return { ok: true };
  return { ok: false, reason: `tool "${toolName}" is not in the allowlist` };
};

// ---------------------------------------------------------------------------
// Request-metadata policies. These gate on caller identity rather than tool
// name/args, so they need headers + client IP threaded from the gateway.

export type PreCallVerdict = { ok: true } | { ok: false; reason: string };

const getHeader = (
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined => {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
};

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

// IPv4 helpers. Full CIDR library would be overkill — a dotted-quad parse and
// masked-integer compare covers the single-org MVP. IPv6 falls back to exact
// string match so unknown-shape inputs deny-by-default instead of silently
// allowing.

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
