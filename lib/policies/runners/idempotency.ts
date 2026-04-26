// idempotency_required, reject duplicate tool calls inside a TTL window.
// Key comes from either an opaque header or a deterministic hash of
// (tool_name + args) so agents without retry machinery still get dedupe for
// free via args_hash.

import { createHash } from 'node:crypto';
import { checkIdempotency } from '@/lib/policies/idempotency-store';
import { getHeader } from './shared';

export type IdempotencyConfig = {
  ttl_seconds: number;
  key_source: 'header' | 'args_hash';
};

export type IdempotencyVerdictRunner =
  | { ok: true }
  | {
      ok: false;
      reason: 'idempotency_key_missing' | 'duplicate_request';
      detail?: string;
    };

// Stable JSON serialization, sort keys recursively so the hash is deterministic
// across JS engine iteration orders. `JSON.stringify` with a sorting replacer
// keeps the surface tiny and avoids a dependency.
const stableStringify = (value: unknown): string => {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);
    const record = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = walk(record[key]);
    }
    return sorted;
  };
  return JSON.stringify(walk(value));
};

export type IdempotencyRunnerContext = {
  tool_name: string;
  args: unknown;
  headers?: Record<string, string>;
};

export const runIdempotency = (
  ctx: IdempotencyRunnerContext,
  config: IdempotencyConfig,
): IdempotencyVerdictRunner => {
  let key: string;
  if (config.key_source === 'header') {
    const headerKey = getHeader(ctx.headers, 'x-idempotency-key');
    if (!headerKey) {
      return {
        ok: false,
        reason: 'idempotency_key_missing',
        detail: 'x-idempotency-key header required',
      };
    }
    key = headerKey;
  } else {
    const hash = createHash('sha256');
    hash.update(`${ctx.tool_name}:${stableStringify(ctx.args)}`);
    key = hash.digest('hex');
  }

  const now = Date.now();
  const verdict = checkIdempotency(key, config.ttl_seconds);
  if (!verdict.ok) {
    const ageSec = Math.floor((now - verdict.seenAt) / 1000);
    return {
      ok: false,
      reason: 'duplicate_request',
      detail: `idempotency_key=${key} seen ${ageSec}s ago`,
    };
  }
  return { ok: true };
};
