-- Widen servers.transport CHECK to include 'salesforce' (Sprint 7 WP-E.1).
-- The TypeScript union in lib/manifest/cache.ts was updated when E.1 shipped,
-- but the DB CHECK constraint was not — every INSERT of a salesforce server
-- would otherwise fail with a check_violation at runtime.

alter table public.servers drop constraint if exists servers_transport_check;

alter table public.servers
  add constraint servers_transport_check
  check (transport in ('openapi', 'http-streamable', 'salesforce'));
