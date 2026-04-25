// Monitoring time-range picker spec. Datadog/Grafana shape: short ranges
// get fine-grained buckets (~30 bars), long ranges get coarser buckets so
// the chart never shows just 1-2 fat lonely bars. Default `1h` gives 30
// 2-min bars — dense enough to read intent on a fresh demo dataset.

import type { SupabaseClient } from '@supabase/supabase-js';

export type MonitoringRange = '15m' | '30m' | '1h' | '6h' | '24h' | '7d';

export const MONITORING_RANGES: readonly MonitoringRange[] = [
  '15m',
  '30m',
  '1h',
  '6h',
  '24h',
  '7d',
] as const;

export const DEFAULT_MONITORING_RANGE: MonitoringRange = '1h';

export const isMonitoringRange = (value: string): value is MonitoringRange =>
  (MONITORING_RANGES as readonly string[]).includes(value);

export const RANGE_LABEL: Record<MonitoringRange, string> = {
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '6h': '6h',
  '24h': '24h',
  '7d': '7d',
};

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

export type RangeSpec = {
  windowMs: number;
  bucketMs: number;
  bucketCount: number;
  labelMode: 'time' | 'date';
};

export const RANGE_SPECS: Record<MonitoringRange, RangeSpec> = {
  '15m': { windowMs: 15 * MIN_MS, bucketMs: MIN_MS, bucketCount: 15, labelMode: 'time' },
  '30m': { windowMs: 30 * MIN_MS, bucketMs: MIN_MS, bucketCount: 30, labelMode: 'time' },
  '1h': { windowMs: HOUR_MS, bucketMs: 2 * MIN_MS, bucketCount: 30, labelMode: 'time' },
  '6h': { windowMs: 6 * HOUR_MS, bucketMs: 15 * MIN_MS, bucketCount: 24, labelMode: 'time' },
  '24h': { windowMs: DAY_MS, bucketMs: HOUR_MS, bucketCount: 24, labelMode: 'time' },
  '7d': { windowMs: 7 * DAY_MS, bucketMs: DAY_MS, bucketCount: 7, labelMode: 'date' },
};

export const formatBucketLabel = (isoStart: string, mode: 'time' | 'date'): string => {
  const d = new Date(isoStart);
  if (mode === 'time') {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Anchor `now` to the nearest bucket boundary (floored) so the most recent
// bar represents the in-progress window without overshooting into the future.
export const anchorMs = (nowMs: number, spec: RangeSpec): number =>
  Math.floor(nowMs / spec.bucketMs) * spec.bucketMs;

export const bucketStartFor = (eventMs: number, spec: RangeSpec): number =>
  Math.floor(eventMs / spec.bucketMs) * spec.bucketMs;

export const enumerateBuckets = (
  spec: RangeSpec,
  nowMs: number,
): { isoStart: string; label: string }[] => {
  const anchor = anchorMs(nowMs, spec);
  const out: { isoStart: string; label: string }[] = [];
  for (let i = spec.bucketCount - 1; i >= 0; i -= 1) {
    const ms = anchor - i * spec.bucketMs;
    const isoStart = new Date(ms).toISOString();
    out.push({ isoStart, label: formatBucketLabel(isoStart, spec.labelMode) });
  }
  return out;
};

// Auto-pick the smallest range whose window contains the latest event.
// Datadog/Honeycomb pattern — landing the user on a useful default instead
// of an empty chart. Falls back to DEFAULT_MONITORING_RANGE when there is
// no event yet (org never made a gateway call).
export const pickAutoRange = (
  latestEventMs: number | null,
  nowMs: number = Date.now(),
): MonitoringRange => {
  if (latestEventMs === null) return DEFAULT_MONITORING_RANGE;
  const ageMs = Math.max(0, nowMs - latestEventMs);
  for (const range of MONITORING_RANGES) {
    if (ageMs <= RANGE_SPECS[range].windowMs) return range;
  }
  return '7d';
};

// Shared "find the latest event timestamp for this org" helper used by both
// /api/audit and /api/monitoring to drive auto-range selection. Returns
// null when the org has never recorded a gateway call.
export const fetchLatestEventMs = async (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number | null> => {
  const { data, error } = await supabase
    .from('mcp_events')
    .select('created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.created_at) return null;
  const ms = new Date((data as { created_at: string }).created_at).getTime();
  return Number.isNaN(ms) ? null : ms;
};
