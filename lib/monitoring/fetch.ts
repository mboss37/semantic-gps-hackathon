// Read-only aggregations over `mcp_events` for the monitoring dashboard.
// Mirrors the Sprint 12 policy-timeline pattern in
// `app/api/policies/[id]/timeline/route.ts`: pull the last `days` rows,
// bucket in JS. At demo scale (<1000 events) a plain SELECT beats an RPC —
// if this ever grows past ~10k/day we'd push the bucketing into Postgres.
//
// PII pattern names are sourced from `lib/policies/runners/pii-redaction.ts`
// — the runner stays source-of-truth so adding a new PII pattern doesn't
// require a parallel edit here.

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPiiPatternFromSample } from '@/lib/policies/runners/pii-redaction';

type EventRow = {
  created_at: string;
  status: string;
  policy_decisions: unknown;
};

type PolicyDecisionEntry = {
  policy_id?: string;
  policy_name?: string;
  builtin_key?: string;
  mode?: 'shadow' | 'enforce';
  decision?: 'allow' | 'block' | 'redact';
  reason?: string;
  match_samples?: string[];
};

export type CallVolumeBucket = {
  date: string;
  ok: number;
  blocked: number;
  error: number;
};

export type PolicyBlockBucket = {
  date: string;
  byPolicy: Record<string, number>;
};

export type PiiPatternCount = {
  pattern: string;
  count: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (iso: string): string => iso.slice(0, 10);

const emptyDayKeys = (days: number, nowMs: number): string[] => {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(nowMs - i * DAY_MS);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
};

const fetchRows = async (
  supabase: SupabaseClient,
  organizationId: string,
  days: number,
  columns: string,
): Promise<EventRow[]> => {
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('mcp_events')
    .select(columns)
    .eq('organization_id', organizationId)
    .gte('created_at', since);
  if (error) throw new Error(`mcp_events_fetch_failed: ${error.message}`);
  return (data ?? []) as unknown as EventRow[];
};

const decisionsOf = (row: EventRow): PolicyDecisionEntry[] =>
  Array.isArray(row.policy_decisions) ? (row.policy_decisions as PolicyDecisionEntry[]) : [];

export const fetchCallVolume = async (
  supabase: SupabaseClient,
  organizationId: string,
  days: number,
): Promise<CallVolumeBucket[]> => {
  const rows = await fetchRows(supabase, organizationId, days, 'created_at, status');
  const buckets = new Map<string, CallVolumeBucket>();
  for (const key of emptyDayKeys(days, Date.now())) {
    buckets.set(key, { date: key, ok: 0, blocked: 0, error: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(dayKey(row.created_at));
    if (!bucket) continue;
    if (row.status === 'ok') bucket.ok += 1;
    else if (row.status === 'blocked_by_policy') bucket.blocked += 1;
    else bucket.error += 1;
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const fetchPolicyBlocks = async (
  supabase: SupabaseClient,
  organizationId: string,
  days: number,
): Promise<PolicyBlockBucket[]> => {
  const rows = await fetchRows(supabase, organizationId, days, 'created_at, status, policy_decisions');
  const buckets = new Map<string, PolicyBlockBucket>();
  for (const key of emptyDayKeys(days, Date.now())) {
    buckets.set(key, { date: key, byPolicy: {} });
  }
  for (const row of rows) {
    const bucket = buckets.get(dayKey(row.created_at));
    if (!bucket) continue;
    for (const decision of decisionsOf(row)) {
      if (decision.decision !== 'block') continue;
      const name = decision.policy_name ?? 'unknown';
      bucket.byPolicy[name] = (bucket.byPolicy[name] ?? 0) + 1;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const fetchPiiByPattern = async (
  supabase: SupabaseClient,
  organizationId: string,
  days: number,
): Promise<PiiPatternCount[]> => {
  const rows = await fetchRows(supabase, organizationId, days, 'created_at, status, policy_decisions');
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const decision of decisionsOf(row)) {
      const samples = Array.isArray(decision.match_samples) ? decision.match_samples : [];
      for (const sample of samples) {
        if (typeof sample !== 'string') continue;
        const pattern = extractPiiPatternFromSample(sample);
        if (!pattern) continue;
        counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
};
