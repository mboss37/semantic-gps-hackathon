import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runBusinessHours } from '@/lib/policies/built-in';
import { runPreCallPolicies } from '@/lib/policies/enforce';

// WP-G.10: pure time gate on tool calls. Fake timers lock the wall clock so
// the runner's Intl.DateTimeFormat lookup is deterministic, and DST-transition
// instants can be pinned without depending on CI timezone.

const uuid = (n: number): string =>
  `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SERVER_ID = uuid(1);
const TOOL_ID = uuid(2);

const buildManifest = (
  policies: PolicyRow[],
  assignments: Manifest['assignments'],
): Manifest => ({
  loadedAt: Date.now(),
  servers: [],
  tools: [
    {
      id: TOOL_ID,
      server_id: SERVER_ID,
      name: 'getCustomer',
      description: null,
      input_schema: {},
    },
  ],
  relationships: [],
  policies,
  assignments,
  routes: [],
  route_steps: [],
});

const businessHoursPolicy = (
  mode: PolicyRow['enforcement_mode'],
  config: Record<string, unknown>,
): PolicyRow => ({
  id: uuid(10),
  name: 'Business hours only',
  builtin_key: 'business_hours',
  config,
  enforcement_mode: mode,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runBusinessHours (WP-G.10)', () => {
  const config = {
    timezone: 'Europe/Vienna',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as const,
    start_hour: 9,
    end_hour: 17,
  };

  it('passes inside the window (Mon 10:00 Europe/Vienna)', () => {
    // Apr 20 2026 is a Monday. +02:00 because Vienna is CEST in April.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00+02:00'));
    const verdict = runBusinessHours(new Date(), {
      timezone: config.timezone,
      days: [...config.days],
      start_hour: config.start_hour,
      end_hour: config.end_hour,
    });
    expect(verdict.ok).toBe(true);
  });

  it('blocks outside the window on an allowed day (Mon 20:00)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T20:00:00+02:00'));
    const verdict = runBusinessHours(new Date(), {
      timezone: config.timezone,
      days: [...config.days],
      start_hour: config.start_hour,
      end_hour: config.end_hour,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('outside_business_hours');
      expect(verdict.detail).toContain('hour 20');
    }
  });

  it('blocks on a disallowed day (Sat 10:00 Europe/Vienna)', () => {
    // Apr 25 2026 is a Saturday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T10:00:00+02:00'));
    const verdict = runBusinessHours(new Date(), {
      timezone: config.timezone,
      days: [...config.days],
      start_hour: config.start_hour,
      end_hour: config.end_hour,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('outside_business_hours');
      expect(verdict.detail).toContain('sat');
    }
  });

  it('handles the Europe/Vienna DST spring-forward boundary correctly', () => {
    // DST in Europe: last Sunday of March 2026 is Mar 29. Clocks jump from
    // 02:00 CET → 03:00 CEST. We pin a UTC instant of 01:30 UTC which lands
    // at 03:30 CEST on Sunday — still outside 9-17, still Sunday (not in
    // allowed days), so the runner must block and report Sunday, not some
    // off-by-one artifact.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T01:30:00Z'));
    const verdict = runBusinessHours(new Date(), {
      timezone: config.timezone,
      days: [...config.days],
      start_hour: config.start_hour,
      end_hour: config.end_hour,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('outside_business_hours');
      // Sunday is blocked both by day membership and hour. Runner reports
      // the day check first — assert the detail mentions sun, proving the
      // zoned-day lookup is correct across the transition.
      expect(verdict.detail).toContain('sun');
    }
  });
});

describe('runPreCallPolicies dispatch (business_hours)', () => {
  it('enforce mode blocks when outside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T20:00:00+02:00'));
    const policy = businessHoursPolicy('enforce', {
      timezone: 'Europe/Vienna',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      start_hour: 9,
      end_hour: 17,
    });
    const manifest = buildManifest(
      [policy],
      [{ id: uuid(20), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
    );
    const outcome = runPreCallPolicies(
      { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'getCustomer', args: {} },
      manifest,
    );
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('outside_business_hours');
    }
  });
});
