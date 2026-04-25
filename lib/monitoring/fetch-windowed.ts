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
  latency_ms: number | null;
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

// Headline numbers for the KPI strip. `prior` covers the equal-length window
// immediately before the current one so deltas reflect like-for-like change.
export type WindowedKpis = {
  totalCalls: number;
  errorRate: number;
  blockRate: number;
  p95LatencyMs: number;
};

export type WindowedKpiBlock = {
  current: WindowedKpis;
  prior: WindowedKpis;
};

export type WindowedMonitoring = {
  volume: WindowedVolumeBucket[];
  blocks: WindowedPolicyBlockBucket[];
  pii: WindowedPiiCount[];
  kpis: WindowedKpiBlock;
};

const decisionsOf = (row: EventRow): PolicyDecisionEntry[] =>
  Array.isArray(row.policy_decisions) ? (row.policy_decisions as PolicyDecisionEntry[]) : [];

const computeKpis = (rows: EventRow[]): WindowedKpis => {
  const total = rows.length;
  if (total === 0) {
    return { totalCalls: 0, errorRate: 0, blockRate: 0, p95LatencyMs: 0 };
  }
  let blocked = 0;
  let errored = 0;
  const latencies: number[] = [];
  for (const r of rows) {
    if (r.status === 'blocked_by_policy') blocked += 1;
    else if (r.status !== 'ok') errored += 1;
    if (typeof r.latency_ms === 'number' && r.latency_ms >= 0) latencies.push(r.latency_ms);
  }
  // p95 via partial-quickselect would be cheaper for huge windows; sort is
  // fine at hackathon scale (single window of mcp_events, single org).
  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1);
  const p95LatencyMs = latencies.length > 0 ? latencies[Math.max(p95Index, 0)] : 0;
  return {
    totalCalls: total,
    errorRate: errored / total,
    blockRate: blocked / total,
    p95LatencyMs,
  };
};

export const fetchMonitoringWindowed = async (
  supabase: SupabaseClient,
  organizationId: string,
  range: MonitoringRange,
  nowMs: number = Date.now(),
  serverId?: string,
): Promise<WindowedMonitoring> => {
  const spec = RANGE_SPECS[range];
  const anchor = anchorMs(nowMs, spec);
  const earliest = anchor - (spec.bucketCount - 1) * spec.bucketMs;
  const windowMs = spec.bucketCount * spec.bucketMs;
  const priorEarliest = earliest - windowMs;
  const priorSince = new Date(priorEarliest).toISOString();

  // Single query covering BOTH the current window and the prior equal-length
  // window. Splits in JS — half the network cost, same data, simpler than
  // two parallel selects. Optional serverId filter lets server-detail pages
  // reuse the exact same compute path scoped to one MCP server.
  let query = supabase
    .from('mcp_events')
    .select('created_at, status, policy_decisions, latency_ms')
    .eq('organization_id', organizationId)
    .gte('created_at', priorSince);
  if (serverId) {
    query = query.eq('server_id', serverId);
  }
  const { data, error } = await query;
  if (error) throw new Error(`mcp_events_fetch_failed: ${error.message}`);
  const allRows = (data ?? []) as unknown as EventRow[];
  const rows: EventRow[] = [];
  const priorRows: EventRow[] = [];
  for (const row of allRows) {
    const ms = new Date(row.created_at).getTime();
    if (Number.isNaN(ms)) continue;
    if (ms >= earliest) rows.push(row);
    else if (ms >= priorEarliest) priorRows.push(row);
  }

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
    kpis: {
      current: computeKpis(rows),
      prior: computeKpis(priorRows),
    },
  };
};
