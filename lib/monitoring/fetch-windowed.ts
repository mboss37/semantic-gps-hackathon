// Windowed monitoring fetch — bucket size derived from `MonitoringRange`,
// not hardcoded to days. Single SQL round-trip pulls every column we need
// for all three charts (volume / per-policy blocks / PII counts), so a
// range switch costs one DB query, not three.

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPiiPatternFromSample } from '@/lib/policies/runners/pii-redaction';
import {
  RANGE_SPECS,
  anchorMs,
  bucketStartFor,
  enumerateBuckets,
  type MonitoringRange,
} from '@/lib/monitoring/range';

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

export type WindowedVolumeBucket = {
  date: string;
  dateLabel: string;
  ok: number;
  blocked: number;
  error: number;
};

export type WindowedPolicyBlockBucket = {
  date: string;
  dateLabel: string;
  byPolicy: Record<string, number>;
};

export type WindowedPiiCount = {
  pattern: string;
  count: number;
};

export type WindowedMonitoring = {
  volume: WindowedVolumeBucket[];
  blocks: WindowedPolicyBlockBucket[];
  pii: WindowedPiiCount[];
};

const decisionsOf = (row: EventRow): PolicyDecisionEntry[] =>
  Array.isArray(row.policy_decisions) ? (row.policy_decisions as PolicyDecisionEntry[]) : [];

export const fetchMonitoringWindowed = async (
  supabase: SupabaseClient,
  organizationId: string,
  range: MonitoringRange,
  nowMs: number = Date.now(),
): Promise<WindowedMonitoring> => {
  const spec = RANGE_SPECS[range];
  const anchor = anchorMs(nowMs, spec);
  const earliest = anchor - (spec.bucketCount - 1) * spec.bucketMs;
  const since = new Date(earliest).toISOString();

  const { data, error } = await supabase
    .from('mcp_events')
    .select('created_at, status, policy_decisions')
    .eq('organization_id', organizationId)
    .gte('created_at', since);
  if (error) throw new Error(`mcp_events_fetch_failed: ${error.message}`);
  const rows = (data ?? []) as unknown as EventRow[];

  const orderedVolume: WindowedVolumeBucket[] = [];
  const orderedBlocks: WindowedPolicyBlockBucket[] = [];
  const volume = new Map<string, WindowedVolumeBucket>();
  const blocks = new Map<string, WindowedPolicyBlockBucket>();
  for (const { isoStart, label } of enumerateBuckets(spec, nowMs)) {
    const v: WindowedVolumeBucket = {
      date: isoStart,
      dateLabel: label,
      ok: 0,
      blocked: 0,
      error: 0,
    };
    const b: WindowedPolicyBlockBucket = {
      date: isoStart,
      dateLabel: label,
      byPolicy: {},
    };
    volume.set(isoStart, v);
    blocks.set(isoStart, b);
    orderedVolume.push(v);
    orderedBlocks.push(b);
  }

  const pii = new Map<string, number>();
  const lastBucketCeiling = anchor + spec.bucketMs;
  for (const row of rows) {
    const ms = new Date(row.created_at).getTime();
    if (Number.isNaN(ms) || ms < earliest || ms >= lastBucketCeiling) continue;
    const bucketStart = new Date(bucketStartFor(ms, spec)).toISOString();
    const v = volume.get(bucketStart);
    if (v) {
      if (row.status === 'ok') v.ok += 1;
      else if (row.status === 'blocked_by_policy') v.blocked += 1;
      else v.error += 1;
    }
    const b = blocks.get(bucketStart);
    if (b) {
      for (const decision of decisionsOf(row)) {
        if (decision.decision !== 'block') continue;
        const name = decision.policy_name ?? 'unknown';
        b.byPolicy[name] = (b.byPolicy[name] ?? 0) + 1;
      }
    }
    for (const decision of decisionsOf(row)) {
      const samples = Array.isArray(decision.match_samples) ? decision.match_samples : [];
      for (const sample of samples) {
        if (typeof sample !== 'string') continue;
        const pattern = extractPiiPatternFromSample(sample);
        if (!pattern) continue;
        pii.set(pattern, (pii.get(pattern) ?? 0) + 1);
      }
    }
  }

  return {
    volume: orderedVolume,
    blocks: orderedBlocks,
    pii: Array.from(pii.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count),
  };
};
