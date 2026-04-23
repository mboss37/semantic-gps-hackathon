-- Sprint 9 WP-G.10 + G.11: widen policies.builtin_key CHECK with the two new
-- gateway-native builtins — business_hours (time-window gate) and
-- write_freeze (kill-switch for write tools). Idempotent via
-- `drop constraint if exists`, same pattern as 20260423120100_builtin_keys.sql.

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
    'ip_allowlist',
    'business_hours',
    'write_freeze'
  ));
