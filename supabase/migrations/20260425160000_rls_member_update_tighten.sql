-- Sprint 16 WP-L.1 follow-up: tighten memberships UPDATE policy.
--
-- Reviewer caught a tenant-escape: the original `member_update_self` USING
-- and WITH CHECK were both pinned only to `user_id = auth.uid()`. A
-- malicious user could run:
--   UPDATE memberships SET organization_id = '<victim-org>' WHERE user_id = auth.uid()
-- Both clauses pass (row still theirs post-update), and on next token
-- refresh the custom_access_token_hook picks up the spoofed org → tenant
-- escape.
--
-- Fix: WITH CHECK now pins `organization_id` to `public.jwt_org_id()` (the
-- tamper-proof JWT claim) and `role` to 'admin' (single-admin MVP). User can
-- still update their own row (e.g. flip `profile_completed` through the
-- onboarding flow), but the scope-defining columns are immutable at the DB
-- layer.
--
-- V2: when multi-org + role expansion lands, this policy evolves with a
-- deliberate migration. See CLAUDE.md § Key Decisions (single-admin MVP).

DROP POLICY IF EXISTS member_update_self ON public.memberships;

CREATE POLICY member_update_self ON public.memberships
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = public.jwt_org_id()
    AND role = 'admin'
  );
