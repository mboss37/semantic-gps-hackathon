-- Sprint 19: Enhance custom_access_token_hook with two features:
--
--   1. Stamp `profile_completed` into JWT claims alongside `organization_id`.
--      Eliminates the ~2ms DB round-trip in proxy.ts on every authenticated
--      request — the proxy reads the claim from the already-validated JWT
--      instead of querying memberships.
--
--   2. Support `active_org_id` for V2 multi-org users. The hook checks
--      `raw_user_meta_data->>'active_org_id'` first; if set AND the user has
--      a valid membership for that org, it wins. Otherwise falls back to
--      ORDER BY created_at ASC LIMIT 1 (current single-org behavior).
--
-- Idempotent: CREATE OR REPLACE on the same function signature.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  org_id uuid;
  active_pref uuid;
  is_profile_completed boolean;
BEGIN
  -- V2 multi-org: check if the user has an active_org_id preference
  -- stored in raw_user_meta_data. Only honour it if they actually have
  -- a membership in that org (handles deleted orgs / revoked memberships).
  active_pref := (
    event->'claims'->'raw_user_meta_data'->>'active_org_id'
  )::uuid;

  IF active_pref IS NOT NULL THEN
    SELECT m.organization_id, m.profile_completed
      INTO org_id, is_profile_completed
      FROM public.memberships m
     WHERE m.user_id = (event->>'user_id')::uuid
       AND m.organization_id = active_pref
     LIMIT 1;
  END IF;

  -- Fallback: oldest membership (single-org MVP default). Also covers
  -- the case where active_org_id pointed at a non-existent membership.
  IF org_id IS NULL THEN
    SELECT m.organization_id, m.profile_completed
      INTO org_id, is_profile_completed
      FROM public.memberships m
     WHERE m.user_id = (event->>'user_id')::uuid
     ORDER BY m.created_at ASC
     LIMIT 1;
  END IF;

  claims := event->'claims';

  IF org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(org_id::text));
  END IF;

  -- Stamp profile_completed as a boolean claim. Defaults to false when
  -- no membership exists (same as the DB column default).
  claims := jsonb_set(
    claims,
    '{profile_completed}',
    to_jsonb(COALESCE(is_profile_completed, false))
  );

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  -- Never block login. Hook failure = no claim this cycle; user logs in with
  -- no org_id claim, RLS sees NULL, every tenant query returns zero rows.
  -- Fail-visible (empty dashboard) is better than fail-closed (locked out).
  RETURN event;
END;
$$;
