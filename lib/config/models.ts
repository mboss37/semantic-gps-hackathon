// Env-driven Anthropic model IDs. Fail-loud on missing env so we never
// silently fall back to a production model during local iteration, and the
// demo-recording model is never accidentally cheaper-than-it-should-be.
//
// Mirrors the throw-on-missing pattern from `lib/supabase/service.ts`: empty
// strings and undefined both raise, so a Vercel "Sensitive" env dropout
// surfaces as a stack trace instead of silent fallback to a hardcoded
// default.

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} env var is required but not set`);
  }
  return value;
};

export const modelPlayground = (): string => requireEnv('PLAYGROUND_MODEL');

export const modelEvaluateGoal = (): string => requireEnv('EVALUATE_GOAL_MODEL');
