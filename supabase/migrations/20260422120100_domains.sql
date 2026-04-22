-- Sprint 4 WP-B.1: domains table + default SalesOps seed.
-- Domains are the mid-tier of the hierarchy (organization -> domain -> server).
-- Every org gets a default 'salesops' domain on signup so the hero demo has
-- a preconfigured scope. The `on_auth_user_created` trigger is extended
-- here so domain provisioning stays in a single SECURITY DEFINER path.

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index idx_domains_organization on public.domains(organization_id);

alter table public.servers
  add column domain_id uuid references public.domains(id) on delete set null;

create index idx_servers_domain on public.servers(domain_id);

-- Extend the signup trigger so a default SalesOps domain is provisioned
-- alongside the org + membership. Single SQL path, no app-layer coordination.
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
  insert into public.domains (organization_id, slug, name, description)
    values (new_org_id, 'salesops', 'SalesOps', 'Sales operations — Salesforce, Slack, GitHub');
  return NEW;
end;
$$;

-- Backfill: every existing org without a salesops domain gets one.
insert into public.domains (organization_id, slug, name, description)
select o.id, 'salesops', 'SalesOps', 'Sales operations — Salesforce, Slack, GitHub'
from public.organizations o
where not exists (
  select 1 from public.domains d
  where d.organization_id = o.id and d.slug = 'salesops'
);
