-- Sprint 16 WP-L.1: Enable Postgres RLS on all 13 tenant tables.
--
-- Defense-in-depth layer. App-layer .eq('organization_id', ...) filters remain
-- as belt-and-braces; this migration is the belt. Cross-org UUID guesses now
-- return zero rows AT THE DB LEVEL — the app layer no longer carries the
-- isolation invariant alone.
--
-- Service-role key bypasses RLS automatically. The MCP gateway path
-- (gateway-handler.ts, proxy-*, manifest/cache.ts, audit/logger.ts, playground
-- token mint) keeps working unchanged.
--
-- Authenticated users access everything through user-scoped clients built from
-- `lib/supabase/server.ts`. Those clients now see ONLY their own org's rows.

-- ---------------------------------------------------------------------------
-- Part 1: JWT claim hook
-- ---------------------------------------------------------------------------
--
-- Supabase custom-access-token hook — fires on every access-token issuance
-- (login + refresh). Reads the user's org from memberships and merges it into
-- the JWT claims so `auth.jwt() ->> 'organization_id'` resolves server-side.
--
-- Hook REGISTRATION is platform config, not SQL. This migration ships the
-- function; enabling it requires:
--   - local:  supabase/config.toml → [auth.hook.custom_access_token] block
--   - hosted: Supabase dashboard → Authentication → Hooks → Custom Access Token
--
-- Both are documented alongside this migration. See .claude/rules/migrations.md.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  org_id uuid;
BEGIN
  -- Single-org MVP: every user has exactly one membership. V2 multi-org
  -- needs explicit "active org" selection (stored on auth.users metadata
  -- or a `memberships.is_active` flag) instead of this LIMIT 1.
  SELECT organization_id INTO org_id
    FROM public.memberships
   WHERE user_id = (event->>'user_id')::uuid
   ORDER BY created_at ASC
   LIMIT 1;

  claims := event->'claims';
  IF org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(org_id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  -- Never block login. Hook failure = no claim this cycle; user logs in with
  -- no org_id claim, RLS sees NULL, every tenant query returns zero rows.
  -- Fail-visible (empty dashboard) is better than fail-closed (locked out).
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Part 2: helper function for RLS USING clauses
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jwt_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'organization_id', '')::uuid
$$;

GRANT EXECUTE ON FUNCTION public.jwt_org_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Part 3: enable RLS + create policies (13 tables)
-- ---------------------------------------------------------------------------

-- organizations: the row IS the org
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.organizations
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (id = public.jwt_org_id())
  WITH CHECK (id = public.jwt_org_id());

-- memberships: users see/update their own; auth admin reads for the hook
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_select_self ON public.memberships
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY member_update_self ON public.memberships
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY member_read_auth_admin ON public.memberships
  AS PERMISSIVE FOR SELECT
  TO supabase_auth_admin
  USING (true);
GRANT SELECT ON public.memberships TO supabase_auth_admin;

-- domains
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.domains
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

-- servers
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.servers
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

-- tools: parent-join to servers (no org_id column)
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.tools
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.servers s
    WHERE s.id = tools.server_id
      AND s.organization_id = public.jwt_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.servers s
    WHERE s.id = tools.server_id
      AND s.organization_id = public.jwt_org_id()
  ));

-- relationships: BOTH tool endpoints must be in-org
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.relationships
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tools t
    JOIN public.servers s ON s.id = t.server_id
    WHERE t.id = relationships.from_tool_id
      AND s.organization_id = public.jwt_org_id()
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tools t1
      JOIN public.servers s1 ON s1.id = t1.server_id
      WHERE t1.id = relationships.from_tool_id
        AND s1.organization_id = public.jwt_org_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.tools t2
      JOIN public.servers s2 ON s2.id = t2.server_id
      WHERE t2.id = relationships.to_tool_id
        AND s2.organization_id = public.jwt_org_id()
    )
  );

-- policies
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.policies
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

-- policy_assignments
ALTER TABLE public.policy_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.policy_assignments
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

-- policy_versions: parent-join via policies
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.policy_versions
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_versions.policy_id
      AND p.organization_id = public.jwt_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_versions.policy_id
      AND p.organization_id = public.jwt_org_id()
  ));

-- routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.routes
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

-- route_steps: parent-join via routes
ALTER TABLE public.route_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.route_steps
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_steps.route_id
      AND r.organization_id = public.jwt_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = route_steps.route_id
      AND r.organization_id = public.jwt_org_id()
  ));

-- mcp_events: org-scoped reads, NULL org rows invisible to users (pre-auth
-- gateway events logged via service-role have organization_id = NULL)
ALTER TABLE public.mcp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.mcp_events
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());

-- gateway_tokens
ALTER TABLE public.gateway_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON public.gateway_tokens
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (organization_id = public.jwt_org_id())
  WITH CHECK (organization_id = public.jwt_org_id());
