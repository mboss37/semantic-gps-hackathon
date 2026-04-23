// rate_limit — thin wrapper around the in-memory token-bucket store in
// `lib/policies/rate-limiter.ts`. Delegates all state handling so the runner
// stays a pure function call at its surface.

import { checkRateLimit } from '@/lib/policies/rate-limiter';
import type { PreCallVerdict } from './shared';

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
