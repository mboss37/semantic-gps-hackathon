import type { Manifest, PolicyAssignmentRow, PolicyRow } from '@/lib/manifest/cache';
import {
  runAllowlist,
  runPiiRedaction,
  type AllowlistConfig,
  type PiiRedactionConfig,
} from '@/lib/policies/built-in';

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

export const runPreCallPolicies = (ctx: PreCallContext, manifest: Manifest): PreCallOutcome => {
  const decisions: PolicyDecision[] = [];
  const policies = applicablePolicies({ server_id: ctx.server_id, tool_id: ctx.tool_id }, manifest);

  for (const policy of policies) {
    if (policy.builtin_key !== 'allowlist') continue;
    const verdict = runAllowlist(ctx.tool_name, policy.config as AllowlistConfig);
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
