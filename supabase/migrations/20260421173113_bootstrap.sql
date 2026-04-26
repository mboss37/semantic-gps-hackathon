-- Sprint 2 bootstrap, proves the migration pipeline end-to-end.
-- Schema design lands in Sprint 3; this migration is intentionally a no-op.
-- Creates an empty namespace for future application tables.
create schema if not exists app;
