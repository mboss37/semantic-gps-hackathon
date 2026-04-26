-- Sprint 15 smoke-test finding: policies + policy_assignments had no
-- `organization_id` column and leaked cross-org. Single-tenant MVP got away
-- with it; multi-tenant (live signups) does not. This migration closes the
-- gap, both tables become org-scoped first-class citizens, same shape as
-- every other business-object table.
--
-- Backfill strategy:
--   * policy_assignments: row has either server_id OR tool_id OR both NULL
--     (org-wide assignment). When server_id is set, inherit from
--     servers.organization_id. When only tool_id is set, inherit via
--     tools.server_id → servers.organization_id. If BOTH are NULL, the
--     assignment has no natural scope, these get deleted in the backfill
--     because an unscoped assignment is meaningless after the migration
--     (the pre-migration "global assignment" semantics was the leak itself).
--   * policies: a policy's org = the org of any of its assignments. If a
--     policy has multiple assignments spanning orgs (MVP demo: only one org
--     exists with data, but the constraint should tolerate a broader case),
--     we pick the earliest assignment's org. Policies with zero assignments
--     after the assignments backfill get deleted (no scope + no callers).
--
-- Post-migration: (name, organization_id) becomes unique so two orgs can
-- each have a `redact_contact_pii` policy without collision.
-- Idempotent via IF NOT EXISTS guards; safe to re-run on `pnpm supabase db
-- reset`.

BEGIN;

-- 1. Add the columns (nullable during backfill).
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.policy_assignments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Backfill policy_assignments via servers + tools joins.
UPDATE public.policy_assignments pa
   SET organization_id = s.organization_id
  FROM public.servers s
 WHERE pa.server_id = s.id
   AND pa.organization_id IS NULL;

UPDATE public.policy_assignments pa
   SET organization_id = s.organization_id
  FROM public.tools t
  JOIN public.servers s ON s.id = t.server_id
 WHERE pa.tool_id = t.id
   AND pa.organization_id IS NULL;

-- 3. Drop truly unscoped assignments (both server_id + tool_id NULL and
--    no org to inherit). These were the pre-migration "global" assignments
--    that leaked, after this migration the concept requires an explicit
--    org scope.
DELETE FROM public.policy_assignments
 WHERE organization_id IS NULL;

-- 4. Backfill policies.organization_id from any surviving assignment.
--    Pick the earliest assignment's org for determinism.
UPDATE public.policies p
   SET organization_id = (
     SELECT pa.organization_id
       FROM public.policy_assignments pa
      WHERE pa.policy_id = p.id
        AND pa.organization_id IS NOT NULL
      ORDER BY pa.id ASC
      LIMIT 1
   )
 WHERE organization_id IS NULL;

-- 5. Orphan policies (no assignments, no org), drop them. They can't be
--    rendered in any dashboard post-migration and can't be attached to
--    anything without a scoping step, so keeping them is just debt.
DELETE FROM public.policies
 WHERE organization_id IS NULL;

-- 6. NOT NULL + indexes + uniqueness.
ALTER TABLE public.policies
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.policy_assignments
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policies_organization
  ON public.policies(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_assignments_organization
  ON public.policy_assignments(organization_id);

-- Two orgs must be able to name a policy the same. Swap the old global
-- unique on name (if any) for (organization_id, name).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'policies'
       AND constraint_type = 'UNIQUE'
       AND constraint_name = 'policies_name_key'
  ) THEN
    ALTER TABLE public.policies DROP CONSTRAINT policies_name_key;
  END IF;
END $$;

ALTER TABLE public.policies
  DROP CONSTRAINT IF EXISTS policies_name_organization_key;
ALTER TABLE public.policies
  ADD CONSTRAINT policies_name_organization_key UNIQUE (organization_id, name);

COMMIT;
