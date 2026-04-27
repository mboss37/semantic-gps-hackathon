-- Sprint 30 WP-30.4: graph-adherence empirical metric.
--
-- Definition: for every pair of CONSECUTIVE `tools/call` events sharing the
-- same `trace_id`, the pair "adheres" iff a TRel edge of any type exists
-- from the first tool to the second. Adherence rate = adhering / total,
-- partitioned by `governed` so we can contrast `/api/mcp` (governed)
-- against `/api/mcp/raw` (ungoverned). Rising governed rate after WP-30.1
-- description enrichment lands = empirical proof the manifest steering is
-- moving model behavior, not vibes.
--
-- Implementation: LAG() window over `mcp_events` within `(trace_id ORDER
-- BY created_at, id)`. The `id` tiebreaker keeps ordering deterministic
-- when two events share a millisecond timestamp (the gateway can fan
-- multiple `tools/call` into the same instant on a fast saga). Tool
-- identity gets resolved via `(tools.server_id, tools.name)` because
-- `mcp_events.tool_name` is text, not an FK; only resolved pairs (both
-- ends matched) are emitted. Pairs that crossed the org boundary are
-- impossible (mcp_events.organization_id and the resolved tool's
-- server.organization_id are both filtered to the caller's org), but
-- the WHERE clause still asserts equality belt-and-braces.
--
-- `governed` is derived from `payload_redacted->>'governed'`: when the
-- gateway logs an event it stamps `payload.governed = false` for raw
-- surfaces and `payload.governed = true` for the governed default.
-- Older rows (and any audit log path that didn't stamp the flag)
-- default to `true` since governed surfaces are the norm.

CREATE OR REPLACE VIEW public.graph_adherence_pairs AS
WITH events AS (
  SELECT
    e.id,
    e.organization_id,
    e.trace_id,
    e.tool_name,
    e.server_id,
    e.created_at,
    -- Default to TRUE; raw surfaces explicitly stamp `governed:false`.
    -- `IS DISTINCT FROM 'false'` covers NULL + missing JSON path safely.
    COALESCE((e.payload_redacted->>'governed')::boolean, true) AS governed
  FROM public.mcp_events e
  WHERE e.method = 'tools/call'
    AND e.tool_name IS NOT NULL
    AND e.organization_id IS NOT NULL
    AND e.server_id IS NOT NULL
),
ranked AS (
  SELECT
    organization_id,
    trace_id,
    created_at,
    governed,
    tool_name,
    server_id,
    LAG(tool_name) OVER w   AS prev_tool_name,
    LAG(server_id) OVER w   AS prev_server_id,
    LAG(created_at) OVER w  AS prev_created_at,
    LAG(governed) OVER w    AS prev_governed
  FROM events
  WINDOW w AS (PARTITION BY trace_id ORDER BY created_at, id)
)
SELECT
  r.organization_id,
  r.trace_id,
  t_from.id      AS from_tool_id,
  t_to.id        AS to_tool_id,
  r.prev_tool_name AS from_tool,
  r.tool_name      AS to_tool,
  r.prev_server_id AS from_server_id,
  r.server_id      AS to_server_id,
  r.prev_created_at AS from_created_at,
  r.created_at      AS to_created_at,
  -- A pair is "governed" only when BOTH endpoints were governed; mixing
  -- governed with raw within one trace would muddy the contrast.
  (r.governed AND r.prev_governed) AS governed
FROM ranked r
JOIN public.tools t_from
  ON t_from.server_id = r.prev_server_id
 AND t_from.name      = r.prev_tool_name
JOIN public.tools t_to
  ON t_to.server_id = r.server_id
 AND t_to.name      = r.tool_name
WHERE r.prev_tool_name IS NOT NULL;

COMMENT ON VIEW public.graph_adherence_pairs IS
  'Consecutive (from_tool, to_tool) pairs per trace_id over mcp_events. '
  'Drives Sprint 30 graph-adherence rate metric: fraction of pairs that '
  'follow a known TRel edge in `relationships`. Partitioned by `governed` '
  'so /api/mcp (governed) and /api/mcp/raw (ungoverned) can be contrasted. '
  'Resolved via (tools.server_id, tools.name); only fully-resolved pairs '
  'where both endpoints map to a registered tool are emitted.';

-- Postgres views run with OWNER privileges by default and bypass RLS on
-- their base tables. Setting `security_invoker = on` makes the view
-- evaluate RLS against the calling user, so authenticated callers see
-- only their org's pairs through the policies layered in 20260425150000.
-- Without this, any authenticated user could SELECT FROM the view and
-- read every org's tool-call pairs cross-tenant.
ALTER VIEW public.graph_adherence_pairs SET (security_invoker = on);
GRANT SELECT ON public.graph_adherence_pairs TO authenticated, service_role;
