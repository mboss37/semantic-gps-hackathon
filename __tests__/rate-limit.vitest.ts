import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRateLimiterForTests,
  checkRateLimit,
} from '@/lib/policies/rate-limiter';
import { runRateLimit } from '@/lib/policies/built-in';

// WP-G.4: sliding 60s window, per-key isolation, cleanup-on-read. Uses fake
// timers so the window-rollover case doesn't require a real wall-clock.

describe('rate-limiter (WP-G.4)', () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    for (let i = 0; i < 5; i += 1) {
      const v = checkRateLimit('k1', { max_rpm: 5 });
      expect(v.ok).toBe(true);
    }
  });

  it('blocks the 6th request when max_rpm=5', () => {
    for (let i = 0; i < 5; i += 1) {
      checkRateLimit('k1', { max_rpm: 5 });
    }
    const v = checkRateLimit('k1', { max_rpm: 5 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/rate_limit_exceeded/);
  });

  it('resets after the 60s window rolls over', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));

    for (let i = 0; i < 3; i += 1) {
      checkRateLimit('k1', { max_rpm: 3 });
    }
    expect(checkRateLimit('k1', { max_rpm: 3 }).ok).toBe(false);

    // Advance 61s — prior window is stale, new window starts fresh.
    vi.setSystemTime(new Date(2026, 0, 1, 12, 1, 1));
    expect(checkRateLimit('k1', { max_rpm: 3 }).ok).toBe(true);
  });

  it('isolates buckets per identity key', () => {
    for (let i = 0; i < 3; i += 1) {
      checkRateLimit('agent-a', { max_rpm: 3 });
    }
    expect(checkRateLimit('agent-a', { max_rpm: 3 }).ok).toBe(false);
    // Different identity: independent budget.
    expect(checkRateLimit('agent-b', { max_rpm: 3 }).ok).toBe(true);
  });

  it('fail-closes when max_rpm is zero or invalid', () => {
    expect(checkRateLimit('k', { max_rpm: 0 }).ok).toBe(false);
    expect(checkRateLimit('k', { max_rpm: -1 }).ok).toBe(false);
    expect(checkRateLimit('k', { max_rpm: 1.5 }).ok).toBe(false);
  });
});

describe('runRateLimit (built-in wrapper)', () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it('delegates to checkRateLimit with the identity + config', () => {
    expect(runRateLimit('org-a', { max_rpm: 2 }).ok).toBe(true);
    expect(runRateLimit('org-a', { max_rpm: 2 }).ok).toBe(true);
    const third = runRateLimit('org-a', { max_rpm: 2 });
    expect(third.ok).toBe(false);
  });
});
