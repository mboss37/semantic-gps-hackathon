// injection_guard — scan serialized tool args for LLM prompt-injection and
// SQL-injection signatures. Tuned for the demo hero scenario, not a
// comprehensive WAF. Callers can extend via config.patterns; the built-ins
// always run first.

import type { PreCallVerdict } from './shared';

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
