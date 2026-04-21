-- Sprint 3 WP-3.1 core schema.
-- Six tables covering the MCP control plane: server registry, tool descriptors,
-- typed relationships (TRel), policies with shadow/enforce mode, policy
-- assignments, and the audit stream. Schema mirrors docs/ARCHITECTURE.md.
-- Single-org MVP: RLS stays off. user_id columns exist for future re-enable.

create extension if not exists pgcrypto;

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  origin_url text,
  transport text not null check (transport in ('http-streamable', 'openapi')),
  openapi_spec jsonb,
  auth_config jsonb,
  created_at timestamptz not null default now()
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null,
  description text,
  input_schema jsonb,
  unique (server_id, name)
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  from_tool_id uuid not null references public.tools(id) on delete cascade,
  to_tool_id uuid not null references public.tools(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'depends_on', 'composes_into', 'alternative_to', 'prerequisite',
    'conflicts_with', 'enables', 'requires_auth', 'deprecated_by'
  )),
  description text not null,
  unique (from_tool_id, to_tool_id, relationship_type)
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  builtin_key text not null check (builtin_key in (
    'pii_redaction', 'rate_limit', 'allowlist', 'injection_guard'
  )),
  config jsonb not null default '{}'::jsonb,
  enforcement_mode text not null default 'shadow' check (enforcement_mode in ('shadow', 'enforce')),
  created_at timestamptz not null default now()
);

create table public.policy_assignments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  server_id uuid references public.servers(id) on delete cascade,
  tool_id uuid references public.tools(id) on delete cascade
);

create table public.mcp_events (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null,
  server_id uuid references public.servers(id) on delete set null,
  tool_name text,
  method text not null,
  policy_decisions jsonb not null default '[]'::jsonb,
  status text not null,
  latency_ms integer,
  payload_redacted jsonb,
  created_at timestamptz not null default now()
);

create index idx_mcp_events_trace on public.mcp_events(trace_id);
create index idx_mcp_events_created on public.mcp_events(created_at desc);
create index idx_tools_server on public.tools(server_id);
create index idx_relationships_from on public.relationships(from_tool_id);
create index idx_relationships_to on public.relationships(to_tool_id);
create index idx_policy_assignments_policy on public.policy_assignments(policy_id);
create index idx_policy_assignments_server on public.policy_assignments(server_id);
create index idx_policy_assignments_tool on public.policy_assignments(tool_id);
