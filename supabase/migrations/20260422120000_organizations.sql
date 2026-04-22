-- Sprint 4 WP-A.1: organizations + memberships + auto-create trigger.
-- Single-admin-per-org MVP. First signup auto-provisions an org + admin
-- membership. `servers.user_id` is replaced with `organization_id` so every
-- server row is org-scoped from day one.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_org on public.memberships(organization_id);

-- Auto-create org + admin membership on every new auth.users row.
-- security definer so the trigger can write to public.* regardless of the
-- caller's role (supabase auth path runs as the authenticator role).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  handle text;
begin
  handle := coalesce(split_part(NEW.email, '@', 1), 'user');
  insert into public.organizations (name)
    values (handle || '''s Workspace')
    returning id into new_org_id;
  insert into public.memberships (organization_id, user_id, role)
    values (new_org_id, NEW.id, 'admin');
  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Migrate servers: user_id -> organization_id.
alter table public.servers
  add column organization_id uuid references public.organizations(id) on delete cascade;

-- Backfill existing servers (hosted may have Sprint 3 rows; local reset has none).
do $$
declare
  rec record;
  new_org_id uuid;
  handle text;
  user_email text;
begin
  for rec in
    select distinct user_id from public.servers where user_id is not null
  loop
    select email into user_email from auth.users where id = rec.user_id;
    handle := coalesce(split_part(user_email, '@', 1), 'user');
    insert into public.organizations (name)
      values (handle || '''s Workspace')
      returning id into new_org_id;
    insert into public.memberships (organization_id, user_id, role)
      values (new_org_id, rec.user_id, 'admin')
      on conflict (organization_id, user_id) do nothing;
    update public.servers
      set organization_id = new_org_id
      where user_id = rec.user_id;
  end loop;
end $$;

-- Backfill pre-existing auth.users who have no server but also no membership
-- (covers any user inserted before this trigger existed).
do $$
declare
  u record;
  new_org_id uuid;
  handle text;
begin
  for u in
    select id, email from auth.users
    where not exists (
      select 1 from public.memberships m where m.user_id = auth.users.id
    )
  loop
    handle := coalesce(split_part(u.email, '@', 1), 'user');
    insert into public.organizations (name)
      values (handle || '''s Workspace')
      returning id into new_org_id;
    insert into public.memberships (organization_id, user_id, role)
      values (new_org_id, u.id, 'admin');
  end loop;
end $$;

alter table public.servers alter column organization_id set not null;
alter table public.servers drop column user_id;

create index idx_servers_organization on public.servers(organization_id);
