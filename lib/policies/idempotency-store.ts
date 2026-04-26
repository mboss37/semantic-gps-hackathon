// Sprint 10 WP-G.15: in-memory idempotency store for duplicate-request dedupe.
// Mirrors rate-limiter shape, module-level Map, cleanup-on-read. Single-
// process scope (Redis/distributed backing is deferred to V2).

type Entry = { seenAt: number };

const entries = new Map<string, Entry>();

export type IdempotencyVerdict =
  | { ok: true }
  | { ok: false; seenAt: number };

export const checkIdempotency = (
  key: string,
  ttlSeconds: number,
): IdempotencyVerdict => {
  const now = Date.now();
  const ttlMs = ttlSeconds * 1000;

  // Cleanup-on-read: evict stale entries as we visit them so the Map can't
  // grow unbounded across many unique idempotency keys over long uptime.
  for (const [k, entry] of entries) {
    if (now - entry.seenAt > ttlMs) entries.delete(k);
  }

  const existing = entries.get(key);
  if (existing && now - existing.seenAt < ttlMs) {
    return { ok: false, seenAt: existing.seenAt };
  }

  entries.set(key, { seenAt: now });
  return { ok: true };
};

// Test hook, vitest uses this to reset between cases. Not exported via index
// so production code never touches it.
export const __resetIdempotencyStoreForTests = (): void => {
  entries.clear();
};
