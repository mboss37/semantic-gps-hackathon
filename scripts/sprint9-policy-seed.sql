-- Sprint 9 J.5 — realistic policy set for the demo.
--
-- Idempotent: re-running wipes the three policies by name (cascading to
-- assignments + versions) and reinstalls them. Tool-scoped assignments are
-- skipped silently if the Salesforce tools are not present (local empty DB).
--
-- Apply locally:
--   docker cp scripts/sprint9-policy-seed.sql supabase_db_semantic-gps-hackathon:/tmp/s9.sql
--   docker exec supabase_db_semantic-gps-hackathon \
--     psql -U postgres -d postgres -f /tmp/s9.sql
--
-- Apply on hosted: paste into Supabase MCP `execute_sql`.
--
-- Preconditions:
--   - Migrations through 20260424130200_policy_business_hours_write_freeze.sql
--     are applied (business_hours + write_freeze builtin keys).
--   - Demo user + membership + organization exist for tool-scoped assignments.

BEGIN;

-- Reset: remove the legacy allowlist_task_subjects policy and the three we
-- own, so the script is safe to re-run.
DELETE FROM public.policies
 WHERE name IN (
   'allowlist_task_subjects',
   'business_hours_window',
   'write_freeze_killswitch',
   'redact_contact_pii'
 );

-- 1. business_hours_window — enforce, Mon-Fri 09:00-17:00 Europe/Vienna,
--    applied globally.
-- 2. write_freeze_killswitch — enforce mode but disabled initially; the
--    demo flips enabled=true live on the dashboard.
-- 3. redact_contact_pii — shadow mode; scoped to find_account + find_contact
--    so the PII preset can flip it to enforce and see the redaction hit
--    exactly the gateway side.
INSERT INTO public.policies (id, name, builtin_key, config, enforcement_mode)
VALUES
  (
    gen_random_uuid(),
    'business_hours_window',
    'business_hours',
    jsonb_build_object(
      'timezone', 'Europe/Vienna',
      'days', jsonb_build_array('mon', 'tue', 'wed', 'thu', 'fri'),
      'start_hour', 9,
      'end_hour', 17
    ),
    'enforce'
  ),
  (
    gen_random_uuid(),
    'write_freeze_killswitch',
    'write_freeze',
    jsonb_build_object('enabled', false),
    'enforce'
  ),
  (
    gen_random_uuid(),
    'redact_contact_pii',
    'pii_redaction',
    -- Empty config → runPiiRedaction uses the 4 built-in patterns
    -- (email / phone_us / ssn_us / credit_card).
    '{}'::jsonb,
    'shadow'
  );

-- Global assignments (NULL server_id + NULL tool_id = applies everywhere).
INSERT INTO public.policy_assignments (policy_id, server_id, tool_id)
SELECT id, NULL::uuid, NULL::uuid FROM public.policies WHERE name = 'business_hours_window'
UNION ALL
SELECT id, NULL::uuid, NULL::uuid FROM public.policies WHERE name = 'write_freeze_killswitch';

-- Tool-scoped assignments for PII redaction. Emits 0 rows gracefully when
-- the Salesforce tools aren't seeded yet (local empty DB).
INSERT INTO public.policy_assignments (policy_id, server_id, tool_id)
SELECT p.id, NULL::uuid, t.id
  FROM public.policies p
  JOIN public.tools t ON TRUE
 WHERE p.name = 'redact_contact_pii'
   AND t.name IN ('find_account', 'find_contact');

COMMIT;

-- Post-check (read-only): confirm the install.
SELECT p.name,
       p.builtin_key,
       p.enforcement_mode,
       (SELECT count(*) FROM public.policy_assignments pa WHERE pa.policy_id = p.id) AS n_assignments
  FROM public.policies p
 WHERE p.name IN (
   'business_hours_window',
   'write_freeze_killswitch',
   'redact_contact_pii'
 )
 ORDER BY p.name;
