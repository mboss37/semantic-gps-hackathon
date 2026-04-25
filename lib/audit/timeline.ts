// Audit timeline bucketing — same range/bucket spec as monitoring so the
// two surfaces share the time vocabulary. Lives next to the audit logger
// because the timeline schema is owned by audit, not monitoring.

import {
  RANGE_SPECS,
  anchorMs,
  bucketStartFor,
  enumerateBuckets,
  type MonitoringRange,
} from '@/lib/monitoring/range';

export const AUDIT_TIMELINE_STATUS_KEYS = [
  'ok',
  'blocked_by_policy',
  'origin_error',
  'fallback_triggered',
  'rollback_executed',
] as const;

export type AuditTimelineStatusKey = (typeof AUDIT_TIMELINE_STATUS_KEYS)[number];

export type AuditTimelineBucket = {
  date: string;
  dateLabel: string;
} & Record<AuditTimelineStatusKey, number>;

const isStatusKey = (status: string): status is AuditTimelineStatusKey =>
  (AUDIT_TIMELINE_STATUS_KEYS as readonly string[]).includes(status);

const emptyBucket = (date: string, dateLabel: string): AuditTimelineBucket => ({
  date,
  dateLabel,
  ok: 0,
  blocked_by_policy: 0,
  origin_error: 0,
  fallback_triggered: 0,
  rollback_executed: 0,
});

export const bucketAuditTimeline = (
  events: ReadonlyArray<{ created_at: string; status: string }>,
  range: MonitoringRange,
  nowMs: number = Date.now(),
): AuditTimelineBucket[] => {
  const spec = RANGE_SPECS[range];
  const ordered: AuditTimelineBucket[] = [];
  const map = new Map<string, AuditTimelineBucket>();
  for (const { isoStart, label } of enumerateBuckets(spec, nowMs)) {
    const bucket = emptyBucket(isoStart, label);
    map.set(isoStart, bucket);
    ordered.push(bucket);
  }
  const anchor = anchorMs(nowMs, spec);
  const earliest = anchor - (spec.bucketCount - 1) * spec.bucketMs;
  const ceiling = anchor + spec.bucketMs;
  for (const event of events) {
    const ms = new Date(event.created_at).getTime();
    if (Number.isNaN(ms) || ms < earliest || ms >= ceiling) continue;
    const key = new Date(bucketStartFor(ms, spec)).toISOString();
    const bucket = map.get(key);
    if (!bucket) continue;
    if (isStatusKey(event.status)) {
      bucket[event.status] += 1;
    }
  }
  return ordered;
};
