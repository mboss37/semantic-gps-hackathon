-- Sprint 15 WP-C.6: retire legacy vendor transports.
--
-- Before: `servers.transport` accepted 'openapi' | 'http-streamable' |
-- 'salesforce' | 'slack' | 'github'. The vendor values keyed into hand-authored
-- proxies (`lib/mcp/proxy-{salesforce,slack,github}.ts`) that bypassed the
-- dispatcher's uniform http-streamable pipeline.
--
-- After: the three vendor proxies ship as standalone Next.js MCP routes under
-- `app/api/mcps/<vendor>/route.ts` — indistinguishable from any third-party
-- HTTP-streamable upstream. The dispatcher drops vendor branches; every
-- upstream routes through `proxy-http.ts` + `proxy-openapi.ts`.
--
-- Backfill strategy: UPDATE in place so existing `tools` / `relationships` /
-- `route_steps` / `policy_assignments` FKs (which reference `servers.id`)
-- keep working. Dropping + re-inserting would cascade-delete demo data.
-- Origin URLs are rewritten to the co-deployed vendor routes; production
-- deploys override via the standard `POST /api/servers` registration flow
-- after cutover.

BEGIN;

-- Step 1: widen the constraint temporarily to accept the legacy + new shape,
-- so the UPDATE below can land before we tighten it. Postgres will reject a
-- narrowing constraint while rows still violate it, so we narrow AFTER the
-- backfill.

ALTER TABLE public.servers DROP CONSTRAINT IF EXISTS servers_transport_check;

-- Step 2: backfill any legacy vendor rows to http-streamable + the route URL.
-- Idempotent: rows already on http-streamable are untouched. We null out
-- `auth_config` because the new vendor routes read credentials from env vars
-- on the same Next.js deployment — per-tenant/per-server credentials are a
-- V2 story (re-introduce via `auth_config` when vendor MCPs are physically
-- extracted to their own deploys).

UPDATE public.servers
   SET transport = 'http-streamable',
       origin_url = 'http://localhost:3000/api/mcps/salesforce',
       auth_config = NULL
 WHERE transport = 'salesforce';

UPDATE public.servers
   SET transport = 'http-streamable',
       origin_url = 'http://localhost:3000/api/mcps/slack',
       auth_config = NULL
 WHERE transport = 'slack';

UPDATE public.servers
   SET transport = 'http-streamable',
       origin_url = 'http://localhost:3000/api/mcps/github',
       auth_config = NULL
 WHERE transport = 'github';

-- Step 3: narrow the constraint back down. Only the two canonical MCP
-- transports remain.

ALTER TABLE public.servers
  ADD CONSTRAINT servers_transport_check
  CHECK (transport IN ('openapi', 'http-streamable'));

COMMIT;
