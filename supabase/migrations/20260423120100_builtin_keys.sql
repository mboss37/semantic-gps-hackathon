-- Sprint 5 WP-G.5: extend policies.builtin_key CHECK with the three
-- request-metadata policies shipped in built-in.ts (basic_auth, client_id,
-- ip_allowlist). Idempotent via `drop constraint if exists` — matches the
-- pattern used in 20260422120200_rel_taxonomy.sql.

alter table public.policies
  drop constraint if exists policies_builtin_key_check;

alter table public.policies
  add constraint policies_builtin_key_check
  check (builtin_key in (
    'pii_redaction',
    'rate_limit',
    'allowlist',
    'injection_guard',
    'basic_auth',
    'client_id',
    'ip_allowlist'
  ));
