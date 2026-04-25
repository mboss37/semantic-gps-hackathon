// Shared chart palette. Single source of truth so every gateway-event
// surface (overview area chart, monitoring stacks, audit bar, policy
// timeline) speaks the same color vocabulary. Hex literals — not CSS
// vars — so dark mode renders without `--chart-*` token drift.

import type { ChartConfig } from '@/components/ui/chart';

export const STATUS_COLORS = {
  ok: '#22c55e',
  blocked_by_policy: '#f59e0b',
  origin_error: '#ef4444',
  fallback_triggered: '#3b82f6',
  rollback_executed: '#fb923c',
  invalid_input: '#eab308',
  unauthorized: '#f43f5e',
} as const;

export type AuditStatus = keyof typeof STATUS_COLORS;

export const STATUS_LABELS: Record<AuditStatus, string> = {
  ok: 'Allowed',
  blocked_by_policy: 'Blocked',
  origin_error: 'Origin error',
  fallback_triggered: 'Fallback',
  rollback_executed: 'Rollback',
  invalid_input: 'Invalid input',
  unauthorized: 'Unauthorized',
};

// Shared Tailwind classes for the row + sheet status badges. Centralized so
// the audit table, audit detail Sheet, and audit chart all read the same
// vocabulary — no drift between the three surfaces.
export const STATUS_BADGE_CLASS: Record<AuditStatus, string> = {
  ok: 'border-emerald-500/30 text-emerald-400',
  blocked_by_policy: 'border-amber-500/30 text-amber-400',
  origin_error: 'border-red-500/30 text-red-400',
  fallback_triggered: 'border-blue-500/30 text-blue-400',
  rollback_executed: 'border-orange-500/30 text-orange-400',
  invalid_input: 'border-amber-500/30 text-amber-400',
  unauthorized: 'border-red-500/30 text-red-400',
};

export const statusBadgeClassFor = (status: string): string =>
  status in STATUS_BADGE_CLASS ? STATUS_BADGE_CLASS[status as AuditStatus] : '';

export const volumeChartConfig: ChartConfig = {
  ok: { label: 'Allowed', color: STATUS_COLORS.ok },
  blocked: { label: 'Blocked', color: STATUS_COLORS.blocked_by_policy },
  error: { label: 'Error', color: STATUS_COLORS.origin_error },
};

export const verdictChartConfig: ChartConfig = {
  allow: { label: 'Allowed', color: STATUS_COLORS.ok },
  shadow_block: { label: 'Shadow block', color: STATUS_COLORS.blocked_by_policy },
  enforce_block: { label: 'Enforce block', color: STATUS_COLORS.origin_error },
};

export const piiChartConfig: ChartConfig = {
  count: { label: 'Detections', color: STATUS_COLORS.blocked_by_policy },
};

export const POLICY_PALETTE = [
  '#3b82f6',
  '#a855f7',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
] as const;

export const buildPolicyChartConfig = (
  policyNames: readonly string[],
  otherKey?: string,
): ChartConfig => {
  const config: ChartConfig = {};
  policyNames.forEach((name, idx) => {
    config[name] = {
      label: name,
      color: POLICY_PALETTE[idx % POLICY_PALETTE.length],
    };
  });
  if (otherKey) {
    config[otherKey] = {
      label: 'Other',
      color: '#71717a',
    };
  }
  return config;
};
