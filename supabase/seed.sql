-- Local-only demo user. Runs after migrations on `pnpm supabase db reset`.
-- Credentials are intentionally hardcoded (demo@semantic-gps.dev / demo-password-123)
-- for local Docker stack only. Sign in through `/login` with email/password —
-- dev-login bypass was removed in Sprint 6 WP-A.4. seed.sql is ignored by
-- `supabase db push`, so hosted never sees this row.

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'demo@semantic-gps.dev',
  crypt('demo-password-123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', ''
where not exists (
  select 1 from auth.users where email = 'demo@semantic-gps.dev'
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email = 'demo@semantic-gps.dev'
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

-- K.1 interaction: the `handle_new_user` trigger fires AFTER migrations so
-- the auto-created demo membership picks up `profile_completed=false` from
-- the column default. K.1's migration backfill already ran against an empty
-- table and can't retroactively flip this row. Explicit UPDATE keeps demo
-- logins routed straight to /dashboard instead of the A.7 onboarding wizard.
-- Also gives the auto-seeded org a friendlier name for the demo-day UX.
update public.memberships
   set profile_completed = true
 where user_id = '11111111-1111-1111-1111-111111111111';

update public.organizations o
   set name = 'Semantic GPS Demo',
       created_by = '11111111-1111-1111-1111-111111111111'
  from public.memberships m
 where m.user_id = '11111111-1111-1111-1111-111111111111'
   and o.id = m.organization_id;

-- Sprint 24: SalesOps domain seeded here (demo-only) instead of in the
-- signup trigger. Real users signing up no longer get an auto-provisioned
-- "Sales operations — Salesforce, Slack, GitHub" domain — that was demo
-- content masquerading as platform behavior. Bootstrap scripts that target
-- the demo user keep working because seed.sql still creates this row.
insert into public.domains (organization_id, slug, name, description)
select m.organization_id, 'salesops', 'SalesOps',
       'Sales operations — Salesforce, Slack, GitHub'
from public.memberships m
where m.user_id = '11111111-1111-1111-1111-111111111111'
on conflict (organization_id, slug) do nothing;

-- Demo gateway token (plaintext intentionally exposed for demo; V2 adds UI
-- to mint + rotate). Clients authenticate with:
--   Authorization: Bearer sgps_demo_token_abcdef0123456789abcdef0123456789abcd
insert into public.gateway_tokens (organization_id, token_hash, name)
select m.organization_id,
       encode(digest('sgps_demo_token_abcdef0123456789abcdef0123456789abcd', 'sha256'), 'hex'),
       'demo'
from public.memberships m
where m.user_id = '11111111-1111-1111-1111-111111111111'
on conflict (token_hash) do nothing;
