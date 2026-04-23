import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';

// Sprint 14 WP-14.2: live origin health probe for /dashboard/servers/[id].
// Compute-on-render, no persistence. HEAD first (cheap), GET fallback once
// if HEAD fails (some origins don't support HEAD). All outbound traffic
// routes through `safeFetch` — never leak internal errors, always map to
// typed `reason` strings.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const PROBE_TIMEOUT_MS = 2_000;

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';
type HealthReason = 'no_origin' | 'ssrf_blocked' | 'timeout' | 'network_error';

type ProbeOutcome = {
  status: HealthStatus;
  statusCode?: number;
  reason?: HealthReason;
};

const classifyStatus = (code: number): HealthStatus => {
  if (code >= 200 && code < 400) return 'ok';
  if (code >= 400 && code < 500) return 'degraded';
  return 'down';
};

const classifyThrown = (err: unknown): ProbeOutcome => {
  if (err instanceof SsrfBlockedError) return { status: 'down', reason: 'ssrf_blocked' };
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();
    if (name === 'aborterror' || msg.includes('timeout') || msg.includes('aborted')) {
      return { status: 'down', reason: 'timeout' };
    }
  }
  return { status: 'down', reason: 'network_error' };
};

const probeOnce = async (
  url: string,
  method: 'HEAD' | 'GET',
): Promise<ProbeOutcome> => {
  try {
    const headers: Record<string, string> =
      method === 'GET' ? { accept: 'application/json' } : {};
    const res = await safeFetch(url, { method, headers, timeoutMs: PROBE_TIMEOUT_MS });
    return { status: classifyStatus(res.status), statusCode: res.status };
  } catch (err) {
    return classifyThrown(err);
  }
};

const probeOrigin = async (
  url: string,
): Promise<ProbeOutcome & { latencyMs: number }> => {
  const start = Date.now();
  const head = await probeOnce(url, 'HEAD');
  if (head.status === 'ok') {
    return { ...head, latencyMs: Date.now() - start };
  }
  // Fall back to GET once — some origins reject HEAD with 4xx/405.
  const get = await probeOnce(url, 'GET');
  const latencyMs = Date.now() - start;
  // If GET succeeded or returned a usable HTTP code, prefer it.
  if (get.statusCode !== undefined) return { ...get, latencyMs };
  // Both threw — prefer the retry's classification.
  return { ...get, latencyMs };
};

export const GET = async (
  _request: Request,
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

  const parsed = ParamsSchema.safeParse(await ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from('servers')
    .select('id, origin_url, organization_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }
  const server = row as { id: string; origin_url: string | null; organization_id: string } | null;
  if (!server || server.organization_id !== organization_id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const checkedAt = new Date().toISOString();
  if (!server.origin_url) {
    return NextResponse.json({ status: 'unknown', reason: 'no_origin', checkedAt });
  }

  const outcome = await probeOrigin(server.origin_url);
  return NextResponse.json({ ...outcome, checkedAt });
};
