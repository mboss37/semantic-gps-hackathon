-- Sprint 6 WP-D.2: gateway bearer-token auth.
-- Each row is a SHA-256 hash of a plaintext token that clients pass as
-- `Authorization: Bearer <tok>`. Lookup is by `token_hash`; plaintext is
-- never persisted. V2 adds UI to mint + rotate; for now the demo seed
-- plants one token per demo user.
create table if not exists public.gateway_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  name text not null default 'default',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_gateway_tokens_token_hash on public.gateway_tokens (token_hash);
