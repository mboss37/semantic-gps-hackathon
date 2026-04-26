-- Sprint 22 WP-22.1: Enable Supabase Realtime push for mcp_events.
--
-- Why: dashboard auto-refresh today is tab-focus + manual button (Sprint 21
-- WP-21.5). External MCP calls (Postman, Playground, autonomous agents)
-- require a manual click to see updated traffic. Realtime publication on
-- mcp_events closes that gap, the browser supabase client opens a
-- postgres_changes channel, INSERT events fire the existing
-- useDashboardRefresh hook (2s debounced), KPI cards + chart re-render
-- automatically. Policy decisions live in mcp_events.policy_decisions
-- (jsonb), so one publication covers both call and policy beats.
--
-- RLS isolation: mcp_events has RLS enabled (Sprint 16 L.1) with policy
-- `org_isolation` reading organization_id via jwt_org_id(). Supabase
-- Realtime honours RLS on postgres_changes when REPLICA IDENTITY exposes
-- the filter columns. DEFAULT replica identity sends only PK columns; we
-- need organization_id in the replication stream, so REPLICA IDENTITY FULL.
--
-- Trade-off: REPLICA IDENTITY FULL writes the full pre-image row to WAL on
-- every UPDATE/DELETE. mcp_events is INSERT-only in normal operation
-- (audit-log semantics), so the WAL impact is effectively identical to
-- DEFAULT. Acceptable for hackathon volume; the canonical SSE + windowed
-- aggregator path stays the post-hackathon target.
--
-- Idempotency: ALTER PUBLICATION ADD TABLE raises duplicate_object (42710)
-- if the table is already a member. Wrapped in a DO/EXCEPTION block so
-- re-runs after `supabase db reset` succeed cleanly.

do $$
begin
  alter publication supabase_realtime add table public.mcp_events;
exception
  when duplicate_object then
    raise notice 'mcp_events already in supabase_realtime publication';
end $$;

alter table public.mcp_events replica identity full;
