// pii_redaction, scan request/response payloads for PII and replace matches
// with deterministic placeholders. Pure function: no DB, no manifest.
// Caller decides what to log.
//
// Phone numbers: parsed via libphonenumber-js (Google's libphonenumber port -
// same library Twilio / Stripe / etc. use). Covers US parenthesized format,
// international E.164, common separator variants, and rejects dates / IPs /
// long digit runs that a naive regex would false-positive on. Countries
// default to the global set; a future enhancement can scope by org config.
//
// Non-phone patterns (email, SSN, credit card) stay regex-based because
// libphonenumber handles phones only and those formats are regex-tractable.

import { findPhoneNumbersInText, isSupportedCountry, type CountryCode } from 'libphonenumber-js';

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

// Canonical set of pattern names the runner can emit into `match_samples`.
// Includes every name in `DEFAULT_PII_PATTERNS` PLUS `phone`, which is
// produced by the libphonenumber branch in `redactPhones` (not a regex
// pattern, so it doesn't live in `DEFAULT_PII_PATTERNS`).
//
// Consumers (e.g. monitoring dashboard) SHOULD import from here instead of
// hardcoding a parallel list, if we add a pattern in `DEFAULT_PII_PATTERNS`
// or a new libphonenumber-style branch, this stays the source of truth.
export const PII_PATTERN_NAMES: readonly string[] = [
  'phone',
  ...DEFAULT_PII_PATTERNS.map((p) => p.name),
];

const PII_PATTERN_SET: ReadonlySet<string> = new Set(PII_PATTERN_NAMES);

export const isPiiPatternName = (name: string): boolean => PII_PATTERN_SET.has(name);

// `match_samples` entries are shaped as `<pattern_name>:<preview>…`, see
// the `samples.push(...)` calls in `runPiiRedaction`. This extracts the
// pattern name prefix; returns null when the sample doesn't match the
// expected shape or the prefix isn't a known PII pattern.
export const extractPiiPatternFromSample = (sample: string): string | null => {
  const idx = sample.indexOf(':');
  if (idx <= 0) return null;
  const name = sample.slice(0, idx);
  return isPiiPatternName(name) ? name : null;
};

export type PiiRedactionConfig = {
  patterns?: Array<{ name: string; regex: string; replacement?: string }>;
  // Default region used to parse local-format phone numbers that lack a
  // country code (e.g. "(512) 757-6000" → US). Defaults to 'US'. Pass null
  // to accept only internationally-formatted (E.164) numbers.
  phone_default_country?: string | null;
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
const PHONE_REPLACEMENT = '[redacted:phone]';

// Replace phone numbers in `text` via libphonenumber-js `findPhoneNumbersInText`.
// Splices in order, walking end→start so earlier offsets stay valid as the
// string shrinks. Returns the redacted string + the match count + short
// samples for audit.
const redactPhones = (
  text: string,
  defaultCountry: CountryCode | null,
  existingSamples: string[],
): { redacted: string; count: number } => {
  const matches = defaultCountry
    ? findPhoneNumbersInText(text, { defaultCountry })
    : findPhoneNumbersInText(text);
  if (matches.length === 0) return { redacted: text, count: 0 };

  let out = text;
  for (const m of [...matches].reverse()) {
    out = out.slice(0, m.startsAt) + PHONE_REPLACEMENT + out.slice(m.endsAt);
  }
  for (const m of matches) {
    if (existingSamples.length >= MAX_SAMPLES) break;
    const e164 = m.number.number; // '+15127576000'
    existingSamples.push(`phone:${e164.slice(0, 4)}…`);
  }
  return { redacted: out, count: matches.length };
};

export const runPiiRedaction = (value: unknown, config?: PiiRedactionConfig): PiiRedactionResult => {
  const patterns = compilePatterns(config);
  const samples: string[] = [];
  const rawCountry = config?.phone_default_country;
  const defaultCountry: CountryCode | null =
    rawCountry === null
      ? null
      : rawCountry && isSupportedCountry(rawCountry)
        ? rawCountry
        : 'US';
  let matchCount = 0;

  const walk = (v: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return v;
    if (typeof v === 'string') {
      let out = v;

      const phoneResult = redactPhones(out, defaultCountry, samples);
      matchCount += phoneResult.count;
      out = phoneResult.redacted;

      for (const pattern of patterns) {
        const scanner = new RegExp(pattern.regex.source, pattern.regex.flags);
        const matches = out.match(scanner);
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
