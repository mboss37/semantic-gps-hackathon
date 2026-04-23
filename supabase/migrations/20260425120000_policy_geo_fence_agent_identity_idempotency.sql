-- Sprint 10 WP-G.13 + G.14 + G.15: widen policies.builtin_key CHECK with three
-- new gateway-native builtins — geo_fence (network/data residency),
-- agent_identity_required (identity + attribution), idempotency_required
-- (duplicate-call dedupe). Idempotent via `drop constraint if exists`, same
-- pattern as 20260424130200_policy_business_hours_write_freeze.sql.

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
    'write_freeze',
    'geo_fence',
    'agent_identity_required',
    'idempotency_required'
  ));
