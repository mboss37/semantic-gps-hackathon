-- Sprint B WP-B.4, policy audit history.
-- Every insert/update to `policies` snapshots the new state into
-- `policy_versions`. Diffing is cheap: pull two rows by version and
-- compare config JSON. Mirrors the actual policies schema (column is
-- `enforcement_mode text` with values 'shadow' | 'enforce', not bool).

create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  version int not null,
  config jsonb not null,
  enforcement_mode text not null check (enforcement_mode in ('shadow', 'enforce')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (policy_id, version)
);

create index idx_policy_versions_policy on public.policy_versions(policy_id, version desc);

create or replace function public.snapshot_policy_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version int;
begin
  select coalesce(max(version), 0) + 1
    into next_version
    from public.policy_versions
    where policy_id = NEW.id;

  insert into public.policy_versions (policy_id, version, config, enforcement_mode, created_by)
  values (NEW.id, next_version, NEW.config, NEW.enforcement_mode, auth.uid());

  return NEW;
end;
$$;

create trigger policies_versioned
  after insert or update on public.policies
  for each row execute function public.snapshot_policy_version();
