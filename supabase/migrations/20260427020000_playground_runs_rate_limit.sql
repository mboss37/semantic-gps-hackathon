-- Playground rate-limit accounting (wallet protection).
--
-- Each row = one inbound /api/playground/run request that proceeded to the
-- Anthropic API. The hourly cap (6 runs/hour/org) is enforced in the app
-- layer at lib/playground/rate-limit.ts. The DB just supplies durable
-- per-org accounting that survives Vercel's multi-instance fanout (an
-- in-memory counter on one region cannot block a spammer hitting another).
--
-- BYOK Playground (BACKLOG P1) will eventually shift wallet risk to the
-- end user's API key and remove this table; until then, this is the
-- bridge that keeps the public Vercel deployment from bleeding.

CREATE TABLE public.playground_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_playground_runs_org_created
  ON public.playground_runs (organization_id, created_at DESC);

ALTER TABLE public.playground_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON public.playground_runs
  FOR ALL TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

COMMENT ON TABLE public.playground_runs IS
  'Playground rate-limit accounting. App enforces hourly cap per org at /api/playground/run.';
