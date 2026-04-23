-- Widen servers.transport CHECK to include 'github' (Sprint 8 WP-E.3).
-- Timestamp is after the Slack migration (20260424130000) so apply order is
-- deterministic. The final constraint includes all 5 transports regardless
-- of apply order, which keeps the migration idempotent if the Slack one
-- hasn't landed yet in a given environment.

alter table public.servers drop constraint if exists servers_transport_check;

alter table public.servers
  add constraint servers_transport_check
  check (transport in ('openapi', 'http-streamable', 'salesforce', 'slack', 'github'));
