import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

// Sprint 12 WP-12.4 (I.4): per-policy 7-day shadow→enforce timeline.
// Pulls the last `days` of `mcp_events` rows that mention this policy in
// their `policy_decisions` jsonb array, then buckets client-side by day +
// (mode, decision) combo. At demo scale (<1000 rows/week) the plain SELECT
// beats an RPC; if this ever grows past ~10k rows/day we'd push the bucket
// into Postgres via a SQL function. For now, JS wins on simplicity.
//
// Org-scoping mirrors `app/api/policies/[id]/route.ts` exactly, policies
// are global-by-intent today, so we rely on the user-scoped Supabase client
// + `.maybeSingle()` to return 404 when the policy doesn't exist. RLS is
// off in the MVP; if a policy id is wrong or unknown, we never leak that
// detail, just 404.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

type PolicyDecisionEntry = {
  policy_id: string;
  mode: 'shadow' | 'enforce';
  decision: 'allow' | 'block' | 'redact';
};

type EventRow = {
  created_at: string;
  policy_decisions: unknown;
};

type Bucket = {
  date: string;
  enforce_block: number;
  shadow_block: number;
  allow: number;
};

const dayKey = (iso: string): string => iso.slice(0, 10);

const emptyBuckets = (days: number, nowMs: number): Map<string, Bucket> => {
  const out = new Map<string, Bucket>();
  // Walk backwards in UTC day buckets to match the `slice(0, 10)` key shape.
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(nowMs - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.set(key, { date: key, enforce_block: 0, shadow_block: 0, allow: 0 });
  }
  return out;
};

const bucketEvents = (rows: EventRow[], policyId: string, days: number): Bucket[] => {
  const buckets = emptyBuckets(days, Date.now());
  for (const row of rows) {
    const decisions = Array.isArray(row.policy_decisions)
      ? (row.policy_decisions as PolicyDecisionEntry[])
      : [];
    for (const d of decisions) {
      if (d.policy_id !== policyId) continue;
      const key = dayKey(row.created_at);
      const b = buckets.get(key);
      if (!b) continue; // event older than the window; ignore
      if (d.decision === 'block' && d.mode === 'enforce') b.enforce_block += 1;
      else if (d.decision === 'block' && d.mode === 'shadow') b.shadow_block += 1;
      else if (d.decision === 'allow') b.allow += 1;
      // `redact` decisions aren't part of the shadow→enforce story, skip.
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const GET = async (
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsedParams = ParamsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedQuery = QuerySchema.safeParse({ days: url.searchParams.get('days') ?? undefined });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'invalid query', details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }
  const { days } = parsedQuery.data;
  const policyId = parsedParams.data.id;

  const { data: policyRow, error: policyErr } = await supabase
    .from('policies')
    .select('id, name')
    .eq('id', policyId)
    .eq('organization_id', organization_id)
    .maybeSingle();
  if (policyErr) {
    console.error('[policy-timeline] policy lookup failed', policyErr instanceof Error ? policyErr.message : 'unknown error');
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }
  const policy = policyRow as { id: string; name: string } | null;
  if (!policy) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: eventRows, error: eventsErr } = await supabase
    .from('mcp_events')
    .select('created_at, policy_decisions')
    .eq('organization_id', organization_id)
    .gte('created_at', since);
  if (eventsErr) {
    console.error('[policy-timeline] events lookup failed', eventsErr instanceof Error ? eventsErr.message : 'unknown error');
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }

  const series = bucketEvents((eventRows ?? []) as EventRow[], policyId, days);

  return NextResponse.json({
    policy_id: policyId,
    policy_name: policy.name,
    days,
    series,
  });
};
