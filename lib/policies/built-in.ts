import { checkRateLimit } from '@/lib/policies/rate-limiter';

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

// ---------------------------------------------------------------------------
// WP-G.4: rate-limit + injection-guard runners.

export type RateLimitConfig = {
  max_rpm: number;
};

export const runRateLimit = (
  identity: string,
  config: RateLimitConfig,
): PreCallVerdict => {
  const verdict = checkRateLimit(identity, config);
  return verdict;
};

// Regex patterns for common LLM prompt-injection / SQL-injection attempts.
// Tuned for the demo hero scenario — not a comprehensive WAF. Callers can
// extend via config.patterns; the built-ins always run first.
export type InjectionPattern = { name: string; regex: RegExp };

export const DEFAULT_INJECTION_PATTERNS: readonly InjectionPattern[] = [
  {
    name: 'ignore_prior',
    regex: /ignore\s+(all\s+)?(previous|prior)\s+(instructions|rules)/i,
  },
  {
    name: 'role_override',
    regex: /(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+/i,
  },
  {
    name: 'im_start',
    regex: /<\|?im_(start|end)\|?>/i,
  },
  {
    name: 'sql_drop',
    regex: /drop\s+table|truncate\s+table/i,
  },
  {
    name: 'sql_comment_inject',
    regex: /(--\s*$|\/\*[^*]*\*\/|;\s*select\s+)/i,
  },
];

export type InjectionGuardConfig = {
  patterns?: Array<{ name: string; regex: string }>;
};

const compileInjectionPatterns = (
  config?: InjectionGuardConfig,
): readonly InjectionPattern[] => {
  const custom = config?.patterns ?? [];
  const compiledCustom = custom.map((p) => ({
    name: p.name,
    regex: new RegExp(p.regex, 'i'),
  }));
  return [...DEFAULT_INJECTION_PATTERNS, ...compiledCustom];
};

export const runInjectionGuard = (
  args: unknown,
  config?: InjectionGuardConfig,
): PreCallVerdict => {
  const haystack = JSON.stringify(args ?? {});
  const patterns = compileInjectionPatterns(config);
  for (const p of patterns) {
    if (p.regex.test(haystack)) {
      return { ok: false, reason: `injection_detected:${p.name}` };
    }
  }
  return { ok: true };
};

// ---------------------------------------------------------------------------
// WP-G.10: business_hours — block tool calls outside a configured weekly
// window. Pure time check; identity and tool name are irrelevant. Uses
// Intl.DateTimeFormat(..., {timeZone}) so DST transitions are handled by the
// runtime instead of any hand-rolled offset math.

export type BusinessHoursDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BusinessHoursConfig = {
  timezone: string;
  days: BusinessHoursDay[];
  start_hour: number;
  end_hour: number;
};

const DAY_CODES: Record<string, BusinessHoursDay> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

// Extract day-of-week code + hour-of-day (0-23) in the target timezone for
// the given instant. formatToParts returns stable { type, value } pairs, which
// avoids the locale-specific ordering quirks of toLocaleString.
const getZonedDayAndHour = (
  now: Date,
  timezone: string,
): { day: BusinessHoursDay; hour: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '';
  const hourNum = Number(hourStr);
  // `en-US` + `hour12: false` can emit "24" for midnight on some ICU versions;
  // normalise to 0 so the 0-23 invariant holds.
  const hour = hourNum === 24 ? 0 : hourNum;
  const day = DAY_CODES[weekday] ?? 'mon';
  return { day, hour };
};

export type BusinessHoursVerdict =
  | { ok: true }
  | { ok: false; reason: 'outside_business_hours'; detail: string };

export const runBusinessHours = (
  now: Date,
  config: BusinessHoursConfig,
): BusinessHoursVerdict => {
  const { day, hour } = getZonedDayAndHour(now, config.timezone);
  if (!config.days.includes(day)) {
    return {
      ok: false,
      reason: 'outside_business_hours',
      detail: `day ${day} not in allowed days [${config.days.join(', ')}] (tz=${config.timezone})`,
    };
  }
  if (hour < config.start_hour || hour >= config.end_hour) {
    return {
      ok: false,
      reason: 'outside_business_hours',
      detail: `hour ${hour} outside window ${config.start_hour}-${config.end_hour} (tz=${config.timezone}, day=${day})`,
    };
  }
  return { ok: true };
};

// ---------------------------------------------------------------------------
// WP-G.11: write_freeze — kill switch an org can flip during incidents or
// audits. Either freezes a named subset of write tools (tool_names) or the
// whole surface (tool_names omitted). Passes through when disabled.

export type WriteFreezeConfig = {
  enabled: boolean;
  tool_names?: string[];
};

export type WriteFreezeVerdict =
  | { ok: true }
  | { ok: false; reason: 'write_freeze_active'; detail: string };

export const runWriteFreeze = (
  toolName: string,
  config: WriteFreezeConfig,
): WriteFreezeVerdict => {
  if (!config.enabled) return { ok: true };
  const scoped = config.tool_names;
  if (!scoped || scoped.length === 0) {
    return {
      ok: false,
      reason: 'write_freeze_active',
      detail: `write freeze active (all tools); tool "${toolName}" blocked`,
    };
  }
  if (scoped.includes(toolName)) {
    return {
      ok: false,
      reason: 'write_freeze_active',
      detail: `write freeze active; tool "${toolName}" is in frozen list`,
    };
  }
  return { ok: true };
};
