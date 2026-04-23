import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manifest, PolicyRow } from '@/lib/manifest/cache';
import { runBusinessHours } from '@/lib/policies/built-in';
import { runPreCallPolicies } from '@/lib/policies/enforce';

// WP-G.10 + WP-13.4: pure time gate on tool calls. Fake timers lock the wall
// clock so the runner's Intl.DateTimeFormat lookup is deterministic, and
// DST-transition instants can be pinned without depending on CI timezone.
//
// Coverage split:
// - Legacy-shape tests drive `runPreCallPolicies` so they exercise the Zod
//   union's `.transform()` leg (legacy row → canonical `{timezone, windows}`).
//   This is the only place the transform runs in production, so hitting it
//   here is the real backcompat guarantee.
// - New-shape tests call `runBusinessHours` directly — runner only sees the
//   canonical shape, and multi-window + overnight-wrap semantics live there.

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

const dispatch = (
  config: Record<string, unknown>,
  mode: PolicyRow['enforcement_mode'] = 'enforce',
) => {
  const policy = businessHoursPolicy(mode, config);
  const manifest = buildManifest(
    [policy],
    [{ id: uuid(20), policy_id: policy.id, server_id: SERVER_ID, tool_id: null }],
  );
  return runPreCallPolicies(
    { server_id: SERVER_ID, tool_id: TOOL_ID, tool_name: 'getCustomer', args: {} },
    manifest,
  );
};

afterEach(() => {
  vi.useRealTimers();
});

describe('business_hours legacy shape via dispatch (backcompat)', () => {
  const legacyConfig = {
    timezone: 'Europe/Vienna',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    start_hour: 9,
    end_hour: 17,
  };

  it('passes inside the window (Mon 10:00 Europe/Vienna) — legacy row transforms to single window', () => {
    // Apr 20 2026 is a Monday. +02:00 because Vienna is CEST in April.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00+02:00'));
    const outcome = dispatch(legacyConfig);
    expect(outcome.action).toBe('allow');
  });

  it('blocks outside the window on an allowed day (Mon 20:00) — legacy row transforms + runner rejects', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T20:00:00+02:00'));
    const outcome = dispatch(legacyConfig);
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('outside_business_hours');
    }
  });

  it('blocks on a disallowed day (Sat 10:00 Europe/Vienna) — legacy row', () => {
    // Apr 25 2026 is a Saturday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T10:00:00+02:00'));
    const outcome = dispatch(legacyConfig);
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('outside_business_hours');
    }
  });

  it('handles the Europe/Vienna DST spring-forward boundary correctly — legacy row', () => {
    // DST in Europe: last Sunday of March 2026 is Mar 29. Clocks jump from
    // 02:00 CET → 03:00 CEST. UTC 01:30 lands at 03:30 CEST on Sunday —
    // outside 9-17 AND not in Mon-Fri, so the dispatch path must block.
    // This case is load-bearing: if the runtime's tz offset math drifted,
    // the runner would land on Saturday (a disallowed day for a different
    // reason) or Monday (an allowed day) and the assertion would flip.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T01:30:00Z'));
    const outcome = dispatch(legacyConfig);
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('outside_business_hours');
    }
  });
});

describe('runBusinessHours — multi-window allow-list', () => {
  it('Mon 10:00 passes (first window), Fri 10:00 passes (second), Fri 15:00 blocks', () => {
    const config = {
      timezone: 'Europe/Vienna',
      windows: [
        {
          days: ['mon', 'tue', 'wed', 'thu'] as const,
          start_hour: 9,
          end_hour: 17,
        },
        { days: ['fri'] as const, start_hour: 9, end_hour: 13 },
      ],
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00+02:00')); // Mon 10:00 CEST
    expect(
      runBusinessHours(new Date(), {
        timezone: config.timezone,
        windows: config.windows.map((w) => ({ ...w, days: [...w.days] })),
      }).ok,
    ).toBe(true);

    vi.setSystemTime(new Date('2026-04-24T10:00:00+02:00')); // Fri 10:00 CEST
    expect(
      runBusinessHours(new Date(), {
        timezone: config.timezone,
        windows: config.windows.map((w) => ({ ...w, days: [...w.days] })),
      }).ok,
    ).toBe(true);

    vi.setSystemTime(new Date('2026-04-24T15:00:00+02:00')); // Fri 15:00 CEST
    const blocked = runBusinessHours(new Date(), {
      timezone: config.timezone,
      windows: config.windows.map((w) => ({ ...w, days: [...w.days] })),
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toBe('outside_business_hours');
      expect(blocked.detail).toContain('windows=2');
    }
  });
});

describe('runBusinessHours — overnight wrap', () => {
  const overnightConfig: {
    timezone: string;
    windows: Array<{ days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>; start_hour: number; end_hour: number }>;
  } = {
    timezone: 'Europe/Vienna',
    windows: [{ days: ['fri'], start_hour: 22, end_hour: 4 }],
  };

  it('evening portion: Fri 23:00 Vienna passes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T23:00:00+02:00')); // Fri 23:00 CEST
    const verdict = runBusinessHours(new Date(), overnightConfig);
    expect(verdict.ok).toBe(true);
  });

  it('morning portion: Sat 01:00 Vienna passes (yesterday=Fri, hour<end=4)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T01:00:00+02:00')); // Sat 01:00 CEST
    const verdict = runBusinessHours(new Date(), overnightConfig);
    expect(verdict.ok).toBe(true);
  });

  it('outside both portions: Sat 05:00 blocks, Mon 01:00 blocks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T05:00:00+02:00')); // Sat 05:00 CEST
    const a = runBusinessHours(new Date(), overnightConfig);
    expect(a.ok).toBe(false);

    vi.setSystemTime(new Date('2026-04-20T01:00:00+02:00')); // Mon 01:00 CEST
    // Sun is day-before-Mon; Sun not in window.days=['fri'] → block.
    const b = runBusinessHours(new Date(), overnightConfig);
    expect(b.ok).toBe(false);
    if (!b.ok) {
      expect(b.reason).toBe('outside_business_hours');
    }
  });
});

describe('runBusinessHours — per-window timezone override', () => {
  const config: {
    timezone: string;
    windows: Array<{
      timezone?: string;
      days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
      start_hour: number;
      end_hour: number;
    }>;
  } = {
    timezone: 'UTC',
    windows: [
      { timezone: 'America/New_York', days: ['mon'], start_hour: 9, end_hour: 17 },
    ],
  };

  it('Mon 14:00 UTC (= Mon 10:00 NY EDT) passes via window override', () => {
    vi.useFakeTimers();
    // Apr 20 2026 is DST in the US (EDT, UTC-4). 14:00 UTC → 10:00 NY.
    vi.setSystemTime(new Date('2026-04-20T14:00:00Z'));
    const verdict = runBusinessHours(new Date(), config);
    expect(verdict.ok).toBe(true);
  });

  it('Mon 22:00 UTC (= Mon 18:00 NY EDT) blocks — outside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T22:00:00Z'));
    const verdict = runBusinessHours(new Date(), config);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('outside_business_hours');
    }
  });
});

describe('runPreCallPolicies dispatch — malformed new-shape config', () => {
  it('empty windows array fails Zod .min(1) → business_hours_config_invalid via dispatch', () => {
    // The runner never sees this — Zod rejects first. Assert through dispatch
    // to prove the fail-closed path (block with `business_hours_config_invalid`
    // reason) is wired all the way to the gateway verdict surface.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00+02:00'));
    const outcome = dispatch(
      { timezone: 'UTC', windows: [] },
      'enforce',
    );
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('business_hours_config_invalid');
    }
  });
});

describe('runPreCallPolicies dispatch (business_hours)', () => {
  it('enforce mode blocks when outside the window — legacy shape, dispatched', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T20:00:00+02:00'));
    const outcome = dispatch(
      {
        timezone: 'Europe/Vienna',
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        start_hour: 9,
        end_hour: 17,
      },
      'enforce',
    );
    expect(outcome.action).toBe('block');
    if (outcome.action === 'block') {
      expect(outcome.reason).toBe('outside_business_hours');
    }
  });
});
