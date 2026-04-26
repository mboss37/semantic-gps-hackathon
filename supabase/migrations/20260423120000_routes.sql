-- Sprint 5 WP-B.2: routes + route_steps tables.
-- Routes are the deterministic replay unit, an ordered list of tool calls
-- with optional fallback + rollback. `tool_id` uses `on delete restrict` so
-- we can't orphan a step by deleting the tool; `fallback_route_id` uses
-- `on delete set null` so a broken fallback doesn't cascade-delete the
-- primary route.

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index idx_routes_organization on public.routes(organization_id);
create index idx_routes_domain on public.routes(domain_id);

create table public.route_steps (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  step_order int not null,
  tool_id uuid not null references public.tools(id) on delete restrict,
  input_mapping jsonb not null default '{}'::jsonb,
  output_capture_key text,
  fallback_route_id uuid references public.routes(id) on delete set null,
  rollback_tool_id uuid references public.tools(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (route_id, step_order)
);

create index idx_route_steps_route on public.route_steps(route_id, step_order);
