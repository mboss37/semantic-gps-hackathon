import { z } from 'zod';
import type { Manifest, PolicyAssignmentRow, PolicyRow } from '@/lib/manifest/cache';
import {
  runAllowlist,
  runBasicAuth,
  runBusinessHours,
  runClientId,
  runInjectionGuard,
  runIpAllowlist,
  runPiiRedaction,
  runRateLimit,
  runWriteFreeze,
  type AllowlistConfig,
  type ClientIdConfig,
  type InjectionGuardConfig,
  type IpAllowlistConfig,
  type PiiRedactionConfig,
  type PreCallVerdict,
  type RateLimitConfig,
} from '@/lib/policies/built-in';

const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const BusinessHoursConfigSchema = z.object({
  timezone: z.string().min(1),
  days: z.array(z.enum(DAY_ENUM)).min(1),
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(0).max(23),
});

const WriteFreezeConfigSchema = z.object({
  enabled: z.boolean(),
  tool_names: z.array(z.string().min(1)).optional(),
});

// The gateway hot-path adapter for policies. Turns an assignment-graph plus
// a call context into a list of decisions (for audit) and — when mode is
// enforce — a concrete side effect (block a call, or swap in a redacted
// result). Every `enforcement_mode` flip is a DB column change, never code.

export type PolicyDecisionKind = 'allow' | 'block' | 'redact';

export type PolicyDecision = {
  policy_id: string;
  policy_name: string;
  builtin_key: PolicyRow['builtin_key'];
  mode: PolicyRow['enforcement_mode'];
  decision: PolicyDecisionKind;
  reason?: string;
  match_samples?: string[];
};

export type PreCallContext = {
  server_id: string;
  tool_id: string;
  tool_name: string;
  args: unknown;
  // Populated by the MCP gateway from the incoming Request. Optional so
  // non-gateway callers (tests, tool-dispatcher direct paths) can skip them —
  // the request-metadata policies deny-by-default when missing.
  headers?: Record<string, string>;
  client_ip?: string;
};

export type PostCallContext = PreCallContext & { result: unknown };

export type PreCallOutcome =
  | { action: 'allow'; decisions: PolicyDecision[] }
  | { action: 'block'; decisions: PolicyDecision[]; reason: string };

export type PostCallOutcome = {
  result: unknown;
  decisions: PolicyDecision[];
};

const isApplicable = (
  assignment: PolicyAssignmentRow,
  ctx: { server_id: string; tool_id: string },
): boolean => {
  if (assignment.tool_id && assignment.tool_id !== ctx.tool_id) return false;
  if (assignment.server_id && assignment.server_id !== ctx.server_id) return false;
  if (!assignment.tool_id && !assignment.server_id) return true; // org-wide
  return true;
};

const applicablePolicies = (
  ctx: { server_id: string; tool_id: string },
  manifest: Manifest,
): PolicyRow[] => {
  const policyIds = new Set<string>();
  for (const assignment of manifest.assignments) {
    if (!isApplicable(assignment, ctx)) continue;
    policyIds.add(assignment.policy_id);
  }
  return manifest.policies.filter((p) => policyIds.has(p.id));
};

const getHeaderLoose = (
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

const evaluatePreCall = (policy: PolicyRow, ctx: PreCallContext): PreCallVerdict | null => {
  switch (policy.builtin_key) {
    case 'allowlist':
      return runAllowlist(ctx.tool_name, policy.config as AllowlistConfig);
    case 'basic_auth':
      return runBasicAuth(ctx.headers);
    case 'client_id':
      return runClientId(ctx.headers, policy.config as ClientIdConfig);
    case 'ip_allowlist':
      return runIpAllowlist(ctx.client_ip, policy.config as IpAllowlistConfig);
    case 'rate_limit': {
      // Identity preference: post-auth x-org-id header (threaded by gateway
      // after D.2 token resolve) > client IP > 'anon'. Keeps rate-limit per
      // caller, not per gateway process.
      const identity =
        getHeaderLoose(ctx.headers, 'x-org-id') ?? ctx.client_ip ?? 'anon';
      return runRateLimit(identity, policy.config as RateLimitConfig);
    }
    case 'injection_guard':
      return runInjectionGuard(ctx.args, policy.config as InjectionGuardConfig);
    case 'business_hours': {
      const parsed = BusinessHoursConfigSchema.safeParse(policy.config);
      if (!parsed.success) {
        return { ok: false, reason: 'business_hours_config_invalid' };
      }
      return runBusinessHours(new Date(), parsed.data);
    }
    case 'write_freeze': {
      const parsed = WriteFreezeConfigSchema.safeParse(policy.config);
      if (!parsed.success) {
        return { ok: false, reason: 'write_freeze_config_invalid' };
      }
      return runWriteFreeze(ctx.tool_name, parsed.data);
    }
    default:
      return null;
  }
};

export const runPreCallPolicies = (ctx: PreCallContext, manifest: Manifest): PreCallOutcome => {
  const decisions: PolicyDecision[] = [];
  const policies = applicablePolicies({ server_id: ctx.server_id, tool_id: ctx.tool_id }, manifest);

  for (const policy of policies) {
    const verdict = evaluatePreCall(policy, ctx);
    if (verdict === null) continue;
    if (verdict.ok) {
      decisions.push({
        policy_id: policy.id,
        policy_name: policy.name,
        builtin_key: policy.builtin_key,
        mode: policy.enforcement_mode,
        decision: 'allow',
      });
      continue;
    }
    decisions.push({
      policy_id: policy.id,
      policy_name: policy.name,
      builtin_key: policy.builtin_key,
      mode: policy.enforcement_mode,
      decision: 'block',
      reason: verdict.reason,
    });
    if (policy.enforcement_mode === 'enforce') {
      return { action: 'block', decisions, reason: verdict.reason };
    }
  }

  return { action: 'allow', decisions };
};

export const runPostCallPolicies = (ctx: PostCallContext, manifest: Manifest): PostCallOutcome => {
  const decisions: PolicyDecision[] = [];
  let result = ctx.result;
  const policies = applicablePolicies({ server_id: ctx.server_id, tool_id: ctx.tool_id }, manifest);

  for (const policy of policies) {
    if (policy.builtin_key !== 'pii_redaction') continue;
    const { match_count, match_samples, redacted } = runPiiRedaction(
      result,
      policy.config as PiiRedactionConfig,
    );
    if (match_count === 0) {
      decisions.push({
        policy_id: policy.id,
        policy_name: policy.name,
        builtin_key: policy.builtin_key,
        mode: policy.enforcement_mode,
        decision: 'allow',
      });
      continue;
    }
    decisions.push({
      policy_id: policy.id,
      policy_name: policy.name,
      builtin_key: policy.builtin_key,
      mode: policy.enforcement_mode,
      decision: 'redact',
      reason: `found ${match_count} PII match(es)`,
      match_samples,
    });
    if (policy.enforcement_mode === 'enforce') {
      result = redacted;
    }
  }

  return { result, decisions };
};
