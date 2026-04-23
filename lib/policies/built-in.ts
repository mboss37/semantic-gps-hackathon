// Barrel for built-in policy runners. Each runner + its Config/Verdict types
// + its private helpers live under `lib/policies/runners/` so every file stays
// inside the 400-line budget and diffs cleanly. Import sites continue to use
// `@/lib/policies/built-in` — they never need to know about the split.

export { runPiiRedaction, DEFAULT_PII_PATTERNS } from './runners/pii-redaction';
export type {
  PiiPattern,
  PiiRedactionConfig,
  PiiRedactionResult,
} from './runners/pii-redaction';

export { runAllowlist } from './runners/allowlist';
export type { AllowlistConfig, AllowlistVerdict } from './runners/allowlist';

export type { PreCallVerdict } from './runners/shared';

export { runBasicAuth } from './runners/basic-auth';
export type { BasicAuthConfig } from './runners/basic-auth';

export { runClientId } from './runners/client-id';
export type { ClientIdConfig } from './runners/client-id';

export { runIpAllowlist, matchCidr } from './runners/ip-allowlist';
export type { IpAllowlistConfig } from './runners/ip-allowlist';

export { runRateLimit } from './runners/rate-limit';
export type { RateLimitConfig } from './runners/rate-limit';

export { runInjectionGuard, DEFAULT_INJECTION_PATTERNS } from './runners/injection-guard';
export type { InjectionPattern, InjectionGuardConfig } from './runners/injection-guard';

export { runBusinessHours } from './runners/business-hours';
export type {
  BusinessHoursDay,
  BusinessHoursConfig,
  BusinessHoursVerdict,
} from './runners/business-hours';

export { runWriteFreeze } from './runners/write-freeze';
export type { WriteFreezeConfig, WriteFreezeVerdict } from './runners/write-freeze';

export { runGeoFence } from './runners/geo-fence';
export type { GeoFenceConfig, GeoFenceVerdict } from './runners/geo-fence';

export { runAgentIdentity } from './runners/agent-identity';
export type {
  AgentIdentityConfig,
  AgentIdentityVerdict,
} from './runners/agent-identity';

export { runIdempotency } from './runners/idempotency';
export type {
  IdempotencyConfig,
  IdempotencyVerdictRunner,
  IdempotencyRunnerContext,
} from './runners/idempotency';
