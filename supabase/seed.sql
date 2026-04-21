-- Local-only demo user. Runs after migrations on `pnpm supabase db reset`.
-- Credentials are intentionally hardcoded (demo@semantic-gps.dev / demo-password-123)
-- and mirrored in app/api/auth/dev-login/route.ts — local Docker stack only.
-- seed.sql is ignored by `supabase db push`, so hosted never sees this row.

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
