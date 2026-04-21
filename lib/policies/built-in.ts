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
