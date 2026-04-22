// Sprint 6 WP-G.4: in-memory sliding-window rate limiter. Fixed 60s window,
// cleanup-on-read. Process-local (single Vercel instance per cold start is
// fine for the hackathon); V2 swaps the `Map` for Redis/Upstash without
// touching callers.

const WINDOW_MS = 60_000;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitVerdict = { ok: true } | { ok: false; reason: string };

export const checkRateLimit = (
  key: string,
  config: { max_rpm: number },
): RateLimitVerdict => {
  const now = Date.now();
  const max = Number.isInteger(config.max_rpm) && config.max_rpm > 0 ? config.max_rpm : 0;
  if (max === 0) {
    return { ok: false, reason: 'rate_limit_misconfigured' };
  }

  // Cleanup-on-read: evict stale buckets as we visit them. Prevents the Map
  // from growing unbounded across many identities over long uptime.
  for (const [k, b] of buckets) {
    if (now - b.windowStart > WINDOW_MS) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (existing.count >= max) {
    return { ok: false, reason: `rate_limit_exceeded:${max}_rpm` };
  }

  existing.count += 1;
  return { ok: true };
};

// Test hook — vitest uses this to reset between cases. Not exported via index
// so production code never touches it.
export const __resetRateLimiterForTests = (): void => {
  buckets.clear();
};
