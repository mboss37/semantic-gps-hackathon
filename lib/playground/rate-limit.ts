import { createClient } from '@/lib/supabase/server';

// Wallet-protection rate limit on Playground runs. Each call to
// /api/playground/run hits Anthropic with extended thinking on Opus 4.7
// against the platform's API key. Without this gate, a spammer on the
// public Vercel deployment can bleed the wallet in minutes.

export const PLAYGROUND_LIMIT_PER_HOUR = 6;
export const PLAYGROUND_WINDOW_MS = 60 * 60 * 1000;

export type RateLimitResult =
  | { allowed: true; used: number; limit: number; resetAt: number }
  | { allowed: false; used: number; limit: number; resetAt: number; retryAfterSeconds: number };

const windowStartIso = (): string =>
  new Date(Date.now() - PLAYGROUND_WINDOW_MS).toISOString();

// Reserve a slot for this run if the org is under the hourly cap. Inserts
// the accounting row before the model call so a client that aborts mid-run
// still consumed its slot. Fail-closed: any DB error returns `allowed:false`
// so we never run the model without an audit trail.
export const reservePlaygroundSlot = async (
  organization_id: string,
): Promise<RateLimitResult> => {
  const supabase = await createClient();
  const since = windowStartIso();

  const { count, error: countError } = await supabase
    .from('playground_runs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organization_id)
    .gte('created_at', since);

  if (countError || count === null) {
    return {
      allowed: false,
      used: PLAYGROUND_LIMIT_PER_HOUR,
      limit: PLAYGROUND_LIMIT_PER_HOUR,
      resetAt: Date.now() + PLAYGROUND_WINDOW_MS,
      retryAfterSeconds: 60,
    };
  }

  if (count >= PLAYGROUND_LIMIT_PER_HOUR) {
    const { data: oldest } = await supabase
      .from('playground_runs')
      .select('created_at')
      .eq('organization_id', organization_id)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const oldestMs = oldest ? new Date(oldest.created_at).getTime() : Date.now();
    const resetAt = oldestMs + PLAYGROUND_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

    return {
      allowed: false,
      used: count,
      limit: PLAYGROUND_LIMIT_PER_HOUR,
      resetAt,
      retryAfterSeconds,
    };
  }

  const { error: insertError } = await supabase
    .from('playground_runs')
    .insert({ organization_id });

  if (insertError) {
    return {
      allowed: false,
      used: count,
      limit: PLAYGROUND_LIMIT_PER_HOUR,
      resetAt: Date.now() + PLAYGROUND_WINDOW_MS,
      retryAfterSeconds: 60,
    };
  }

  return {
    allowed: true,
    used: count + 1,
    limit: PLAYGROUND_LIMIT_PER_HOUR,
    resetAt: Date.now() + PLAYGROUND_WINDOW_MS,
  };
};
