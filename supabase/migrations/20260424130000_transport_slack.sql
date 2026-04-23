-- Widen servers.transport CHECK to include 'slack' (Sprint 8 WP-E.2).
-- The TypeScript union in lib/manifest/cache.ts is updated alongside this
-- migration; without the CHECK widening, every INSERT of a slack server
-- would fail with check_violation at runtime.

alter table public.servers drop constraint if exists servers_transport_check;

alter table public.servers
  add constraint servers_transport_check
  check (transport in ('openapi', 'http-streamable', 'salesforce', 'slack'));
