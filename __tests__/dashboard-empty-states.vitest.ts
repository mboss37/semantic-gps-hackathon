import { describe, expect, it } from 'vitest';
import { hasNoGatewayTraffic } from '@/components/chart-area-interactive';
import { fetchOrgRoutes, fetchRouteDetail } from '@/lib/routes/fetch';
import {
  fetchCallVolume,
  fetchPiiByPattern,
  fetchPolicyBlocks,
} from '@/lib/monitoring/fetch';
import { auditEventSchema } from '@/lib/schemas/audit-event';

// WP-17.4: Empty-state audit for the dashboard. Fresh signups previously saw
// blank Recharts canvases, confusing "0 of 0 selected" tables, and CTAs
// pointing at dev-only SQL scripts. These tests pin the decision functions
// that drive the empty-state rendering so we don't regress on a quiet org.
//
// Repo has no jsdom stack (vitest.config.ts environment: 'node'), so we
// exercise the pure helpers + the loaders' empty-data return shapes — the
// same pattern `playground-no-mcp-guard.vitest.ts` established for WP-17.3.

type QueryResult = { data: unknown; error: null };
type Row = Record<string, unknown>;

const ORG = 'org-empty-tests';
const OTHER_ORG = 'org-other';

// Shared minimal Supabase stub supporting the query shapes used by the
// loaders under test: `.from(t).select(c).eq().gte()` and
// `.from(t).select(c).eq().order()`, plus `.maybeSingle()` + `.in()` for
// routes. Mirrors the stub in `monitoring-fetch.vitest.ts` /
// `routes-fetch.vitest.ts` to keep behavior consistent.
const makeClient = (rowsByTable: Record<string, Row[]>) => {
  const buildChain = (table: string) => {
    let rows: Row[] = [...(rowsByTable[table] ?? [])];
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === undefined || r[col] === val);
        return chain;
      },
      gte: (col: string, val: unknown) => {
        rows = rows.filter((r) => (r[col] as string) >= (val as string));
        return chain;
      },
      in: (col: string, vals: unknown[]) => {
        const set = new Set(vals);
        rows = rows.filter((r) => set.has(r[col]));
        return chain;
      },
      order: () => chain,
      maybeSingle: async (): Promise<QueryResult> => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (r: QueryResult) => void) => {
        resolve({ data: rows, error: null });
      },
    };
    return chain;
  };
  return {
    from: (table: string) => buildChain(table),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
};

describe('/dashboard overview — ChartAreaInteractive empty state', () => {
  it('hasNoGatewayTraffic treats still-loading (null) as not-empty so we do not flash the empty card', () => {
    expect(hasNoGatewayTraffic(null)).toBe(false);
  });

  it('hasNoGatewayTraffic returns true when every bucket is zero (fresh signup)', () => {
    const series = [
      { date: '2026-04-17', dateLabel: 'Apr 17', ok: 0, blocked: 0, error: 0 },
      { date: '2026-04-18', dateLabel: 'Apr 18', ok: 0, blocked: 0, error: 0 },
      { date: '2026-04-19', dateLabel: 'Apr 19', ok: 0, blocked: 0, error: 0 },
    ];
    expect(hasNoGatewayTraffic(series)).toBe(true);
  });

  it('hasNoGatewayTraffic returns false as soon as any bucket has any event', () => {
    const onlyOk = [{ date: '2026-04-19', dateLabel: 'Apr 19', ok: 1, blocked: 0, error: 0 }];
    const onlyBlocked = [{ date: '2026-04-19', dateLabel: 'Apr 19', ok: 0, blocked: 1, error: 0 }];
    const onlyError = [{ date: '2026-04-19', dateLabel: 'Apr 19', ok: 0, blocked: 0, error: 1 }];
    expect(hasNoGatewayTraffic(onlyOk)).toBe(false);
    expect(hasNoGatewayTraffic(onlyBlocked)).toBe(false);
    expect(hasNoGatewayTraffic(onlyError)).toBe(false);
  });
});

describe('/dashboard overview — recent-events empty guard', () => {
  it('auditEventSchema parses a real event without crashing on the populated path', () => {
    const good = {
      id: 'e1',
      trace_id: 't1',
      server_id: null,
      server_name: null,
      tool_name: null,
      method: 'initialize',
      status: 'ok',
      latency_ms: null,
      created_at: new Date().toISOString(),
      policy_decisions: [],
    };
    const parsed = auditEventSchema.safeParse(good);
    expect(parsed.success).toBe(true);
  });

  it('auditEventSchema.safeParse on an empty object rejects cleanly (no crash) — empty-feed loader filters these out', () => {
    const parsed = auditEventSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('DashboardPage recent-events filter returns [] when the table is empty', () => {
    // Mirrors the page's `(recentRes.data ?? []).map(...).filter(...)` pipeline.
    const recentData: unknown[] = [];
    const events = recentData
      .map((row) => {
        const parsed = auditEventSchema.safeParse(row);
        return parsed.success ? parsed.data : null;
      })
      .filter((e) => e !== null);
    expect(events).toEqual([]);
    // This is the array length the page branches on to render the empty-state
    // Card instead of the populated DataTable.
    expect(events.length).toBe(0);
  });
});

describe('/dashboard/monitoring — chart loaders on empty data', () => {
  it('fetchCallVolume returns 7 zero-filled buckets so the chart renders an honest empty state', async () => {
    const client = makeClient({ mcp_events: [] });
    const series = await fetchCallVolume(client, ORG, 7);
    expect(series).toHaveLength(7);
    const total = series.reduce((s, b) => s + b.ok + b.blocked + b.error, 0);
    expect(total).toBe(0);
  });

  it('fetchPolicyBlocks returns 7 empty-byPolicy buckets on zero traffic', async () => {
    const client = makeClient({ mcp_events: [] });
    const series = await fetchPolicyBlocks(client, ORG, 7);
    expect(series).toHaveLength(7);
    expect(series.every((b) => Object.keys(b.byPolicy).length === 0)).toBe(true);
  });

  it('fetchPiiByPattern returns [] on zero traffic — PII chart renders the dashed empty card', async () => {
    const client = makeClient({ mcp_events: [] });
    const result = await fetchPiiByPattern(client, ORG, 7);
    expect(result).toEqual([]);
  });
});

describe('/dashboard/routes — list loader on empty data', () => {
  it('fetchOrgRoutes returns [] when the org has zero routes', async () => {
    const client = makeClient({ routes: [], route_steps: [] });
    const routes = await fetchOrgRoutes(client, ORG);
    expect(routes).toEqual([]);
  });

  it('fetchOrgRoutes does not leak routes from other orgs', async () => {
    const client = makeClient({
      routes: [
        { id: 'r1', organization_id: OTHER_ORG, name: 'Other-Org Route', description: null },
      ],
      route_steps: [],
    });
    const routes = await fetchOrgRoutes(client, ORG);
    expect(routes).toEqual([]);
  });

  it('fetchRouteDetail returns null for a cross-org id — route detail page triggers notFound()', async () => {
    const client = makeClient({
      routes: [
        {
          id: 'r1',
          organization_id: OTHER_ORG,
          domain_id: null,
          name: 'Other',
          description: null,
        },
      ],
      route_steps: [],
      tools: [],
    });
    const detail = await fetchRouteDetail(client, ORG, 'r1');
    expect(detail).toBeNull();
  });
});
