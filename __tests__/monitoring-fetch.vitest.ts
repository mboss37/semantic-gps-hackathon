import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCallVolume,
  fetchPiiByPattern,
  fetchPolicyBlocks,
} from '@/lib/monitoring/fetch';

type QueryResult = { data: unknown; error: null };

type Row = Record<string, unknown>;

// Minimal Supabase stub matching `.from(table).select(cols).gte(col, val)`.
// Always ignores the selected columns (tests supply full rows) and applies
// the `.gte` filter against ISO strings.
const makeClient = (rows: Row[]) => {
  const buildChain = () => {
    let filtered: Row[] = [...rows];
    const chain = {
      select: () => chain,
      gte: (col: string, val: unknown) => {
        filtered = filtered.filter((r) => (r[col] as string) >= (val as string));
        return chain;
      },
      then: (resolve: (r: QueryResult) => void) => {
        resolve({ data: filtered, error: null });
      },
    };
    return chain;
  };
  return {
    from: () => buildChain(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
};

const iso = (daysAgo: number): string => {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  // Normalize to noon UTC so the day-bucket math can't slip across midnight.
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
};

// Pin the clock so day-bucket keys are deterministic across runs.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));
  return () => {
    vi.useRealTimers();
  };
});

describe('fetchCallVolume', () => {
  it('counts ok / blocked / error per UTC day', async () => {
    const client = makeClient([
      { created_at: iso(0), status: 'ok', policy_decisions: [] },
      { created_at: iso(0), status: 'ok', policy_decisions: [] },
      { created_at: iso(0), status: 'blocked_by_policy', policy_decisions: [] },
      { created_at: iso(1), status: 'origin_error', policy_decisions: [] },
      { created_at: iso(1), status: 'internal_error', policy_decisions: [] },
    ]);
    const result = await fetchCallVolume(client, 7);
    expect(result).toHaveLength(7);
    const today = result[result.length - 1];
    const yesterday = result[result.length - 2];
    expect(today).toEqual(expect.objectContaining({ ok: 2, blocked: 1, error: 0 }));
    expect(yesterday).toEqual(expect.objectContaining({ ok: 0, blocked: 0, error: 2 }));
  });

  it('returns 7 zero-filled buckets when table empty', async () => {
    const client = makeClient([]);
    const result = await fetchCallVolume(client, 7);
    expect(result).toHaveLength(7);
    expect(result.every((b) => b.ok === 0 && b.blocked === 0 && b.error === 0)).toBe(true);
  });
});

describe('fetchPolicyBlocks', () => {
  it('groups blocks by policy_name and only counts decision=block', async () => {
    const client = makeClient([
      {
        created_at: iso(0),
        status: 'ok',
        policy_decisions: [
          { policy_name: 'pii_redaction', decision: 'redact', mode: 'enforce' },
          { policy_name: 'allowlist', decision: 'allow', mode: 'enforce' },
        ],
      },
      {
        created_at: iso(0),
        status: 'blocked_by_policy',
        policy_decisions: [{ policy_name: 'business_hours', decision: 'block', mode: 'enforce' }],
      },
      {
        created_at: iso(0),
        status: 'blocked_by_policy',
        policy_decisions: [{ policy_name: 'business_hours', decision: 'block', mode: 'shadow' }],
      },
      {
        created_at: iso(1),
        status: 'blocked_by_policy',
        policy_decisions: [{ policy_name: 'allowlist', decision: 'block', mode: 'enforce' }],
      },
    ]);
    const result = await fetchPolicyBlocks(client, 7);
    const today = result[result.length - 1];
    const yesterday = result[result.length - 2];
    expect(today.byPolicy).toEqual({ business_hours: 2 });
    expect(yesterday.byPolicy).toEqual({ allowlist: 1 });
  });

  it('returns zero-filled buckets when no blocks exist', async () => {
    const client = makeClient([]);
    const result = await fetchPolicyBlocks(client, 7);
    expect(result).toHaveLength(7);
    expect(result.every((b) => Object.keys(b.byPolicy).length === 0)).toBe(true);
  });
});

describe('fetchPiiByPattern', () => {
  it('only counts samples matching known PII pattern prefixes, sorted desc', async () => {
    const client = makeClient([
      {
        created_at: iso(0),
        status: 'ok',
        policy_decisions: [
          {
            policy_name: 'pii_redaction',
            decision: 'redact',
            mode: 'enforce',
            match_samples: ['email:al***', 'phone:+43***', 'email:bo***'],
          },
        ],
      },
      {
        created_at: iso(0),
        status: 'ok',
        policy_decisions: [
          {
            policy_name: 'pii_redaction',
            decision: 'redact',
            mode: 'shadow',
            match_samples: ['email:cl***', 'something_else:nope'],
          },
        ],
      },
    ]);
    const result = await fetchPiiByPattern(client, 7);
    expect(result[0]).toEqual({ pattern: 'email', count: 3 });
    expect(result[1]).toEqual({ pattern: 'phone', count: 1 });
    expect(result.find((r) => r.pattern === 'something_else')).toBeUndefined();
  });

  it('returns empty array when no PII detections exist', async () => {
    const client = makeClient([]);
    const result = await fetchPiiByPattern(client, 7);
    expect(result).toEqual([]);
  });
});
