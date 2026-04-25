// Sprint 26: shared origin-probe helper. Extracted from
// app/api/servers/[id]/health/route.ts so the servers list page can probe
// every registered MCP origin in parallel during a single page render —
// surfaces "is it up RIGHT NOW?" on the cards instead of buried on detail.
//
// HEAD first (cheap), GET fallback once if HEAD fails (some origins reject
// HEAD with 4xx/405). All outbound traffic routes through `safeFetch` —
// SSRF guard + 2s timeout cap.

import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';

export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';
export type HealthReason = 'no_origin' | 'ssrf_blocked' | 'timeout' | 'network_error';

export type ProbeOutcome = {
  status: HealthStatus;
  statusCode?: number;
  reason?: HealthReason;
};

export type ProbeResult = ProbeOutcome & { latencyMs: number; checkedAt: string };

export const PROBE_TIMEOUT_MS = 2_000;

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

const probeOnce = async (url: string, method: 'HEAD' | 'GET'): Promise<ProbeOutcome> => {
  try {
    const headers: Record<string, string> =
      method === 'GET' ? { accept: 'application/json' } : {};
    const res = await safeFetch(url, { method, headers, timeoutMs: PROBE_TIMEOUT_MS });
    return { status: classifyStatus(res.status), statusCode: res.status };
  } catch (err) {
    return classifyThrown(err);
  }
};

export const probeOrigin = async (url: string): Promise<ProbeOutcome & { latencyMs: number }> => {
  const start = Date.now();
  const head = await probeOnce(url, 'HEAD');
  if (head.status === 'ok') {
    return { ...head, latencyMs: Date.now() - start };
  }
  const get = await probeOnce(url, 'GET');
  const latencyMs = Date.now() - start;
  if (get.statusCode !== undefined) return { ...get, latencyMs };
  return { ...get, latencyMs };
};

// Convenience wrapper for null-origin servers and timestamped result.
export const probeServerOrigin = async (originUrl: string | null): Promise<ProbeResult> => {
  const checkedAt = new Date().toISOString();
  if (!originUrl) {
    return { status: 'unknown', reason: 'no_origin', latencyMs: 0, checkedAt };
  }
  const outcome = await probeOrigin(originUrl);
  return { ...outcome, checkedAt };
};
