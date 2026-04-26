# Semantic GPS: Architecture (Hackathon MVP)

This document is the operating manual for the 5-day hackathon build. Everything here is decided. Deviations need a reason.

Companion to [`VISION.md`](./VISION.md) (problem framing + post-hackathon shape).

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | **Next.js 16 (App Router)** | Server Components + Route Handlers in one codebase; zero-config Vercel deploy |
| Language | **TypeScript (strict mode)** | No `any`, no `@ts-ignore`. Fix the type. |
| Database | **Supabase (Postgres)** | Local-first dev via `pnpm supabase start` (Docker stack); hosted for prod. Auth + realtime in one dashboard. Free tier is enough for hackathon. |
| Auth | **Supabase Auth (email/password)** | `getUser()` server-side. Never `getSession()`. |
| MCP SDK | **@modelcontextprotocol/sdk** | HTTP-Streamable transport. SSE is deprecated: don't use it. |
| Validation | **Zod** | `.safeParse()` at every boundary. Never `.parse()` in routes. |
| UI primitives | **Radix UI + Tailwind CSS** | Accessible + fast to style. |
| Graph viz | **React Flow** | Workflow graph with drag-to-pan and click-to-inspect. |
| Icons | **Lucide** | Consistent, tree-shakeable. |
| Toasts | **Sonner** | Use `toast()`: never `alert()` or `console.log()`. |
| Charts | **Recharts** | Audit dashboard latency/volume charts. |
| AI for demo | **Anthropic Claude** (@anthropic-ai/sdk) | Demo agent on stage. |
| Package manager | **pnpm** | Not npm, not yarn. |
| Hosting | **Vercel** | Zero-config for Next.js. Fluid Compute default. |

---

## High-Level Data Flow

```
            ┌──────────────┐
            │  AI Agent    │  (Claude, or any MCP client)
            └──────┬───────┘
                   │  MCP JSON-RPC over HTTP-Streamable
                   ▼
        ┌────────────────────────┐
        │  Gateway Route Handler │   app/api/mcp/route.ts
        │  (stateless server)    │
        └──────┬───────────┬─────┘
               │           │
   manifest    │           │   TRel/tools call
   cache       ▼           ▼
          ┌────────┐  ┌──────────────┐
          │ Policy │  │  Origin      │
          │ Engine │  │  Backend     │ (proxied MCP server or OpenAPI)
          └────┬───┘  └──────┬───────┘
               │             │
               └─────┬───────┘
                     ▼
              ┌──────────────┐
              │ Audit Logger │  (fire-and-forget → mcp_events)
              └──────────────┘
```

**Key property:** the gateway is stateless. Every request rebuilds the `McpServer`, loads the manifest from cache, evaluates policies, proxies or handles, and logs. No in-memory session state. Works on Vercel Fluid Compute with zero adjustment.

---

## Project Folder Structure

```
semantic-gps/
├── app/
│   ├── (auth)/                  # Route group: login, signup
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── auth/                # Login/signup handlers (wraps Supabase)
│   │   ├── mcp/
│   │   │   └── route.ts         # THE gateway endpoint: MCP + TRel
│   │   ├── servers/             # CRUD for MCP server registrations
│   │   ├── openapi-import/      # POST a Swagger URL, get an MCP server
│   │   ├── policies/            # Built-in policies CRUD
│   │   ├── relationships/       # Graph edge CRUD
│   │   └── audit/               # Query mcp_events for dashboard
│   ├── dashboard/
│   │   ├── layout.tsx           # Protected shell (auth gate)
│   │   ├── page.tsx             # Workflow graph (React Flow)
│   │   ├── servers/page.tsx     # MCP server registry
│   │   ├── policies/page.tsx    # Policy editor + shadow/enforce toggle
│   │   ├── audit/page.tsx       # Event stream + replay by trace_id
│   │   └── connect/page.tsx     # Sprint 24: self-serve "how do I point my MCP client?": 3-tier scope tabs + endpoint card + 4 snippets + live Test connection
│   ├── layout.tsx
│   └── page.tsx                 # Landing
├── components/
│   ├── graph/                   # React Flow nodes, edges, legend
│   ├── mcp/                     # Server cards, tool list, manifest viewer
│   ├── policies/                # Policy config form, shadow toggle
│   ├── audit/                   # Event row, trace viewer
│   └── ui/                      # Radix-wrapped primitives (Button, Card, Dialog)
├── lib/
│   ├── auth.ts                  # requireAuth helper for route handlers
│   ├── supabase/
│   │   ├── server.ts            # Route handlers + Server Components
│   │   ├── client.ts            # Client components ONLY
│   │   └── service.ts           # Service role: MCP proxy route ONLY
│   ├── mcp/
│   │   ├── stateless-server.ts  # Fresh McpServer per request
│   │   ├── trel-handlers.ts     # discover_relationships, find_workflow_path, validate_workflow
│   │   ├── trel-schemas.ts      # Zod schemas for TRel methods
│   │   └── types.ts             # MCP + TRel shared types
│   ├── routes/
│   │   └── fetch.ts             # Sprint 13: Route + route_steps read helpers (cross-org-safe, tool/fallback name resolution)
│   ├── servers/
│   │   └── fetch.ts             # Sprint 13: Server detail + 7d violation agg + remote resources/prompts introspection
│   ├── monitoring/
│   │   ├── fetch.ts             # Sprint 13: legacy daily aggregations (still used by /api/gateway-traffic)
│   │   ├── range.ts             # Sprint 23: time-range vocabulary (15m/30m/1h/6h/24h/7d) + pickAutoRange + fetchLatestEventMs
│   │   └── fetch-windowed.ts    # Sprint 23: combined volume+blocks+pii fetch in one SQL round-trip, range-aware buckets
│   ├── audit/
│   │   ├── logger.ts            # logMCPEvent: fire-and-forget
│   │   └── timeline.ts          # Sprint 23: pure bucketAuditTimeline(events, range, nowMs) for line-chart timeline
│   ├── charts/
│   │   └── palette.ts           # Sprint 23: STATUS_COLORS/LABELS/BADGE_CLASS + shadcn ChartConfig builders: single source of truth
│   ├── connect/
│   │   └── snippets.ts          # Sprint 24: 4 client snippet templates (curl/Claude Desktop/Inspector/Anthropic SDK) for /dashboard/connect
│   ├── manifest/
│   │   ├── cache.ts             # In-memory cache + load from DB
│   │   └── invalidate.ts        # Called after ANY mutation touching servers/tools/policies/relationships
│   ├── policies/
│   │   ├── built-in.ts          # PII, rate-limit, allowlist, injection-guard: JSON config per policy
│   │   └── enforce.ts           # enforceOrShadow() wrapper
│   ├── openapi/
│   │   └── to-tools.ts          # OpenAPI 3.x → MCP tool descriptors
│   ├── crypto/
│   │   └── encrypt.ts           # AES-256-GCM for stored credentials (server auth_config)
│   ├── security/
│   │   └── ssrf-guard.ts        # validateUrl, safeFetch, fetchWithTimeout
│   └── types/                   # Cross-module TS types + Zod schemas
├── supabase/
│   └── migrations/
│       └── *.sql                # Sequential, timestamp-prefixed
├── __tests__/
│   └── *.vitest.ts              # Vitest unit tests for handlers, policies, OpenAPI converter
├── proxy.ts                     # ⚠️ Next.js 16: use proxy.ts, NOT middleware.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                   # Gitignored: see env section below
```

---

## Database Schema (MVP)

Multi-tenant-ready, RLS off for now. `organizations` + `memberships` hold tenancy; every domain table FKs back to an org. Sprint 15 K.1 widened `memberships.role` to `admin | member` and added four nullable billing columns to `organizations` (`plan`, `trial_ends_at`, `billing_email`, `created_by`) so the schema reads as enterprise-shaped without the UI existing yet. V2 plan picker + trial-countdown + settings UI hang off those columns.

`mcp_events.organization_id` (Sprint 15 K.1) stamps scope identity on every audit row. Nullable because the gateway logs auth-level failures before a scope resolves (missing bearer, invalid token, db_error): those rows genuinely have no org. Post-scope writers thread `scope.organization_id` through `ExecuteRouteCtx` + `logMCPEvent`; V2 narrows this to `NOT NULL` once RLS enables.

**Policy model invariant:** `policy_assignments.policy_id` is an FK reference to `policies.id`: not a fork. One policy row, N assignments (server-scoped, tool-scoped, or global). Edits to a policy cascade to every assignment atomically. If you need divergent behaviour, clone the policy row explicitly; never mutate `policy_assignments.policy_id` mid-flight.

**`domains` positioning:** the mid-tier between organization and server (`/api/mcp/domain/[slug]` scoped gateway). One `salesops` domain auto-seeds per signup for the hero demo; V2 promotes the concept to prod/staging environments. Not dropped: the scoped-gateway relies on it.

**`gateway_tokens` cascade footgun (K.1 documented, not fixed):** `organization_id ON DELETE CASCADE` means deleting an org silently vaporises every token with no audit trail. Fine for MVP where orgs never get deleted; V2 needs a tombstone/soft-delete pattern across every org-owned table (tokens, servers, tools, policies, routes, events) before a half-fix on one table is safe.

```sql
-- Organizations: one per signup. Billing metadata nullable: signals enterprise
-- shape without a V2 plan-picker UI. created_by nullable so pre-K.1 auto-seeded
-- orgs (no onboarding capture) still satisfy the constraint.
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT,
  trial_ends_at TIMESTAMPTZ,
  billing_email TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Memberships: user ↔ org with role + A.7 onboarding gate.
-- K.1 widened role enum to admin|member; profile_completed drives the
-- /onboarding redirect for fresh signups.
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member')),
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Trigger: auto-create org + admin membership + default SalesOps domain on signup.
-- SECURITY DEFINER + pinned search_path; see supabase/migrations/20260422120000_organizations.sql.

-- Domains: mid-tier scope (org → domain → server). Used by the Playground A/B
-- hero demo (gateway serves `/api/mcp/domain/salesops` vs `/api/mcp`).
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, slug)
);

-- Servers: registered MCP backends. Org-scoped, optionally pinned to a domain.
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  origin_url TEXT,               -- NULL for native-Tool servers
  transport TEXT NOT NULL CHECK (transport IN ('http-streamable', 'openapi')),
  openapi_spec JSONB,            -- Cached OpenAPI doc for openapi-transport servers
  auth_config JSONB,             -- Bearer tokens / API keys: AES-256-GCM encrypted via lib/crypto/encrypt.ts
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tools: individual MCP tools exposed by a server
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB,            -- JSON Schema from tools/list
  UNIQUE (server_id, name)
);

-- Relationships: typed graph edges between tools
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  to_tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'produces_input_for', 'requires_before', 'suggests_after', 'mutually_exclusive',
    'alternative_to', 'validates', 'compensated_by', 'fallback_to'
  )),
  description TEXT NOT NULL,
  UNIQUE (from_tool_id, to_tool_id, relationship_type)
);

-- Policies: built-in references with JSON config
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  builtin_key TEXT NOT NULL CHECK (builtin_key IN (
    'pii_redaction', 'rate_limit', 'allowlist', 'injection_guard',
    'basic_auth', 'client_id', 'ip_allowlist',
    'business_hours', 'write_freeze',
    'geo_fence', 'agent_identity_required', 'idempotency_required'
  )),
  config JSONB DEFAULT '{}'::jsonb,  -- Per-policy knobs (e.g. { "max_rpm": 60 } for rate_limit)
  enforcement_mode TEXT NOT NULL DEFAULT 'shadow' CHECK (enforcement_mode IN ('shadow', 'enforce')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Policy assignments: which policy applies to which server/tool
CREATE TABLE policy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE  -- NULL = applies to whole server
);

-- Policy versions: snapshot every insert/update on policies for audit + rollback.
-- Trigger-driven; app layer doesn't write here directly.
CREATE TABLE policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  version INT NOT NULL,
  config JSONB NOT NULL,
  enforcement_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (policy_id, version)
);

-- Routes: named workflow chains scoped to an org (and optionally a domain).
-- Drives the F.1 `execute_route` MCP method and the Playground A/B demo.
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Route steps: ordered tool calls inside a route, with output->input threading,
-- per-step fallback (alt-route), compensating rollback tool reference, and
-- explicit rollback_input_mapping so saga compensation resolves the right
-- shape for the compensator (canonical pattern, Sprint 10).
CREATE TABLE route_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE RESTRICT,
  input_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_input_mapping JSONB,                -- same DSL as input_mapping;
                                               --   $steps.<key>.args.<path>
                                               --   $steps.<key>.result.<path>
                                               --   $inputs.<field>
  output_capture_key TEXT,
  fallback_route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  rollback_tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (route_id, step_order)
);

-- Audit log: every gateway interaction. organization_id (K.1) stamps scope
-- identity threaded from the resolved gateway token through ExecuteRouteCtx.
-- Nullable: auth-level failures (missing bearer / invalid token / db_error)
-- log BEFORE a scope resolves, so those rows genuinely have no org.
CREATE TABLE mcp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,        -- Correlate hops in a workflow
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
  tool_name TEXT,
  method TEXT NOT NULL,          -- MCP method: tools/call, tools/list, discover_relationships, etc.
  policy_decisions JSONB DEFAULT '[]'::jsonb,  -- Array of {policy_name, decision, mode}
  status TEXT NOT NULL,          -- ok, blocked_by_policy, origin_error, fallback_triggered
  latency_ms INTEGER,
  payload_redacted JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mcp_events_trace ON mcp_events(trace_id);
CREATE INDEX idx_mcp_events_created ON mcp_events(created_at DESC);
CREATE INDEX idx_mcp_events_organization ON mcp_events(organization_id, created_at DESC);
CREATE INDEX idx_tools_server ON tools(server_id);
CREATE INDEX idx_relationships_from ON relationships(from_tool_id);
CREATE INDEX idx_relationships_to ON relationships(to_tool_id);
```

**RLS off for MVP.** Single-org, single-user-per-demo. Revisit for V2.

---

## API Surface

### Public (MCP Gateway)
Three-tier routing, shared handler via `lib/mcp/gateway-handler.ts::buildGatewayHandler(scopeResolver)`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/mcp` | Org-scoped MCP JSON-RPC. Returns the full manifest visible to the caller's org. Handles `initialize`, `tools/list`, `tools/call`, plus TRel extensions `discover_relationships`, `find_workflow_path`, `validate_workflow`. |
| POST | `/api/mcp/domain/[slug]` | Domain-scoped gateway. Returns only servers whose `domain_id` matches the org's domain with the given slug. Unknown slug → empty manifest + builtin echo, no crash. |
| POST | `/api/mcp/server/[id]` | Single-server-scoped gateway. Returns one server + its tools + relationships limited to those tools. |

### Dashboard (auth-gated)
All endpoints org-scope via `requireAuth()` → `organization_id`. Every read filters by the caller's org, every insert pins the row to it.

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/servers` | CRUD MCP server registrations (org-scoped) |
| POST | `/api/openapi-import` | `{ url }` → auto-create server + tools |
| GET/POST/DELETE | `/api/relationships` | CRUD graph edges |
| GET/POST/PATCH/DELETE | `/api/policies` | Built-in refs + JSON config |
| POST/DELETE | `/api/policies/:id/assignments` | Attach policy to server/tool |
| GET | `/api/audit?range=…&trace_id=…` | Query events for dashboard. `range` (Sprint 23): `15m|30m|1h|6h|24h|7d`: when omitted, server auto-picks the smallest range whose window contains the latest event. Response: `{events, total, timeline, range}`. Timeline is pre-bucketed for the line chart. |
| GET | `/api/monitoring?range=…&serverId=…` | Sprint 23+24+25: combined volume + per-policy blocks + PII counts + KPI block (totalCalls / errorRate / blockRate / p95LatencyMs) in ONE SQL round-trip. Same range vocabulary as `/api/audit`. Auto-picks range on first load (omit `range`). KPI block carries `current` + equal-length `prior` window for delta cards (Sprint 24 WP-24.2). Optional `serverId` filter scopes everything to a single MCP server (Sprint 25; consumed by `/dashboard/servers/[id]`). Response: `{volume, blocks, pii, kpis, range}` with `dateLabel` pre-formatted. |
| GET | `/api/policies/:id/timeline?days=N` | 7-day (default) shadow→enforce event trail per policy, bucketed by day × verdict |
| POST | `/api/internal/manifest/invalidate` | Dev-gated cache clear (404 in prod unless `MANIFEST_INTROSPECTION_ENABLED=1`). Required after direct DB seeds bypass mutation routes |
| POST | `/api/auth/login` | Supabase email/password login |
| POST | `/api/auth/signup` | Signup (single-user mode: could even disable after first signup) |
| GET | `/auth/callback` | PKCE code exchange after Supabase email verification: establishes session cookies then redirects to `/dashboard` (proxy.ts routes to `/onboarding` if `profile_completed=false`). Shipped Sprint 16 L.1 follow-up |
| PUT | `/api/user/active-org` | `{ organization_id }` → store as `auth.users.raw_user_meta_data.active_org_id`; `custom_access_token_hook` prefers it over the oldest membership when stamping `organization_id` into JWT. 403 if the user has no membership in that org. Shipped Sprint 19 WP-19.8 |

---

## MCP Gateway Architecture

### Stateless Server Factory
Every gateway request calls `createStatelessServer()` which:

1. Creates a fresh `McpServer` instance
2. Loads the current org manifest from `lib/manifest/cache.ts`
3. Registers `tools/list`, `tools/call`, and TRel method handlers
4. Wires in policy enforcement and audit logging
5. Binds to an HTTP-Streamable transport
6. Handles the request
7. Disposes

Why stateless? Vercel Fluid Compute, serverless cold-starts, and horizontal scale. Zero session state to sync.

### Manifest Cache
`lib/manifest/cache.ts` maintains an in-memory compiled view of servers + tools + relationships + policies. Loaded lazily on first request, reloaded on demand.

**Every mutation route that touches servers, tools, relationships, or policies MUST call `await invalidateManifest()` before returning.** This is the single rule that makes live policy reload work.

### Policy Enforcement
`lib/policies/enforce.ts` exposes `enforceOrShadow(policy, context)`:

- `mode === 'enforce'` + violation → reject the call with a structured error
- `mode === 'shadow'` + violation → log the decision but let the call through
- Either way, the decision is written to `mcp_events.policy_decisions`

This single helper wraps every policy check so toggling shadow/enforce is a DB column flip, not a code change.

### TRel Handlers
Implemented as additional JSON-RPC methods on the same MCP endpoint. They share the auth and policy-enforcement stack with standard MCP methods.

- `discover_relationships({ server_id? })` → `{ nodes: tools[], edges: relationships[] }`
- `find_workflow_path({ goal, starting_tool? })` → ordered tool ids
- `validate_workflow({ plan: tool_ids[] })` → `{ valid, violations[] }`

### Vendor MCPs: co-deployed routes

The Salesforce, Slack, and GitHub MCPs ship as standalone Next.js routes under `app/api/mcps/<vendor>/route.ts`. Each route speaks JSON-RPC over HTTP-Streamable via a minimal adapter (`lib/mcp/vendors/json-rpc.ts`) and delegates to a vendor-specific dispatcher (`lib/mcp/vendors/<vendor>.ts`) that handles REST translation + auth. Credentials live in env vars on the same deployment (`SF_*`, `SLACK_BOT_TOKEN`, `GITHUB_PAT`); `auth_config` on the gateway's `servers` row is null for these registrations. The gateway registers them via the normal `POST /api/servers` flow with absolute URLs (e.g. `http://localhost:3000/api/mcps/salesforce`) and dispatches through `proxyHttp` exactly like any third-party MCP: the dispatcher has zero knowledge they run in-process. V2 can extract each route to its own Vercel deploy by changing the `origin_url` in the server row and re-introducing an encrypted per-tenant `auth_config`; no gateway-side code changes are required.

---

## Non-Negotiable Conventions

These are the rules. They come from hard lessons in the original build: skip them and you'll debug for hours.

### TypeScript
- `strict: true`. No `any`. No `@ts-ignore`. No `as any`.
- Catch variables are `unknown`. Narrow: `e instanceof Error ? e.message : String(e)`.
- `useRef(null)`: React 19 requires an initial value.
- Never `!` non-null assertions. Use `?.` and `??`.

### Zod
- `.safeParse()` in route handlers. Never `.parse()`.
- Return `result.error.flatten()` in 400 responses.
- `z.coerce.number()` for query params.

### Supabase
- `supabase.auth.getUser()` for auth. Never `getSession()`: it can be spoofed.
- **User-scoped client** (`lib/supabase/server.ts`) in any route with a user session.
- **Service role client** (`lib/supabase/service.ts`) ONLY in the MCP gateway route (no user session there).
- Check `{ error }`: Supabase errors are returned, not thrown.
- `.single()` only when you expect exactly one row. Else `.maybeSingle()`.

### Next.js
- Server Components default. `"use client"` only when you need state, effects, or handlers.
- Never import `lib/supabase/server.ts` in a client component.
- `export const dynamic = 'force-dynamic'` on GET handlers that return user-specific data.
- `await params`: Next.js 16 params are async.
- ⚠️ Next.js 16 uses `proxy.ts`, **not** `middleware.ts`. If both exist, build fails. Export `proxy`, not `middleware`.

### Git
For a 5-day hackathon, keep it simple:
- `main` + `feature/*` branches
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- No develop branch, no 3-tier flow. Ship straight to main.
- Commit every meaningful slice: demo rollback is a superpower.

### Code style
- `const` over `let`, never `var`
- Arrow functions for components and callbacks
- Named exports, not default
- Early returns over nested conditionals
- Template literals over string concat
- `cn()` utility (clsx + twMerge) for conditional Tailwind
- Mobile-first responsive
- PascalCase component files, kebab-case directories, `use-*.ts` for hooks

### Migration workflow
Rule-of-record: `.claude/rules/migrations.md`. The short version:

- **Filename**: 14-digit `YYYYMMDDHHMMSS_descriptive_name.sql`. Supabase CLI silently skips any other shape (including hyphenated variants like `20260424-02_foo.sql`): not a warning, a no-op. The file is in the repo but never applies.
- **Local iteration**: `pnpm supabase db reset` wipes and re-applies every migration cleanly. Iterate freely; this is the only way to catch ordering bugs before hosted sees them.
- **Hosted push**: `pnpm supabase db push` is the **only** supported path. It stamps `schema_migrations.version` with the filename timestamp, keeping local and remote aligned.
- **Verification**: after every push, `pnpm supabase migration list --linked`. Local and Remote columns must match exactly.
- **Anti-pattern: MCP `apply_migration` against hosted.** It writes `schema_migrations.version = now()` (clock time of apply) instead of the filename timestamp, so the same migration ends up with two different `version` values across local and hosted. The next `db push` refuses to run until the drift is reconciled by hand (UPDATE on hosted `schema_migrations`). We hit this mid-Sprint-15; cost ~20 minutes and a manual SQL cleanup. Use `db push` exclusively.

---

## Security Baseline (Non-Negotiable)

Even for a hackathon: a single embarrassing incident kills the pitch.

- **SSRF guard on every outbound fetch.** `lib/security/ssrf-guard.ts`. Block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16) before any connection. Required for OpenAPI import and any user-supplied URL.
- **Encrypt stored credentials at rest.** Bearer tokens, API keys, and anything written to `servers.auth_config` passes through `lib/crypto/encrypt.ts` (AES-256-GCM). Plaintext in Postgres = table dump = game over.
- **Never hardcode secrets.** Read from `process.env`. Even in tests: use `process.env.X ?? ''`, never inline.
- **Never trust MCP tool arguments.** Validate every `tools/call` payload against the tool's `inputSchema` with Zod before proxying.
- **Never log credentials or secrets.** `logMCPEvent` uses `redactPayload()` to strip known secret patterns before write.
- **Zod `.safeParse()` at every API boundary.** Public endpoints are public: validate everything.

---

## Environment Variables

Create `.env.local` (gitignored) with:

```bash
# Supabase (new 2026 key format: sb_publishable_* / sb_secret_*)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...            # Server only: never expose

# Anthropic for demo agent
ANTHROPIC_API_KEY=<your-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000    # Used for invite links, callbacks

# Credential encryption: AES-256-GCM key for stored server auth_config
CREDENTIALS_ENCRYPTION_KEY=<base64-32-bytes> # Generate once: `openssl rand -base64 32`
```

For Vercel deploy, set these in the project settings: never commit them.

---

## Dev Setup

```bash
# One-time
pnpm install
pnpm supabase login                 # Browser OAuth, caches token
pnpm supabase link --project-ref <ref>  # Wire CLI to hosted project (deploy path)

# Daily
pnpm supabase start                 # Local Docker stack on :54321 (required: never dev against hosted)
pnpm supabase db reset              # Re-apply all migrations against local DB
pnpm dev                            # Next.js on :3000 (Turbopack)
pnpm test                           # Vitest suite
pnpm lint                           # ESLint
pnpm exec tsc --noEmit              # Type check

# Deploy only
pnpm supabase db push               # Apply pending migrations to hosted (run deliberately, not per-iteration)
```

---

## Testing Strategy

Hackathon scope: don't over-test, don't under-test.

**Do test:**
- OpenAPI → MCP tool conversion (pure function, many edge cases)
- TRel handlers: `discover_relationships`, `find_workflow_path`, `validate_workflow` (they're the demo)
- `enforceOrShadow` decision logic: correct matching, enforce vs shadow
- Credential encrypt/decrypt round-trip (irreversible damage if this ever breaks)

**Skip for MVP:**
- E2E (Playwright): you'll demo live
- Integration tests against real DB: too much setup
- UI component tests: you'll see them in the demo

File convention: `__tests__/*.vitest.ts`. Run with `pnpm test`.

---

## Deployment

- **Web:** Vercel: live at https://semantic-gps-hackathon.vercel.app/. Auto-deploy on push to `main`.
- **Env injection:** Supabase Marketplace integration on Vercel auto-syncs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` from the linked hosted project. `ANTHROPIC_API_KEY`, `CREDENTIALS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` are added manually in Vercel project settings (all environments).
- **DB:** Supabase hosted (`cgvxeurmulnlbevinmzj`, Central EU). Free tier is fine for hackathon traffic. Push migrations via `pnpm supabase db push`: only before a real deploy.
- **Demo agent:** Can run locally pointing at the deployed gateway, or embedded in the dashboard as a "try it" panel.

---

## Hard-Won Lessons

Things that will silently bite if not explicitly called out:

1. **Manifest invalidation is easy to forget.** Make `invalidateManifest()` the last line of every mutation route. Consider a lint rule.
2. **Supabase RLS silently returns empty results.** If a user query looks like it "worked" but data is missing, RLS is blocking. Two causes post-Sprint 16: (a) `custom_access_token_hook` isn't registered in the dashboard → JWT has no `organization_id` claim → `jwt_org_id()` returns NULL → every `organization_id = NULL` predicate is false → empty result set across the whole dashboard. (b) Policy covers fewer rows than the caller expects. Diagnose by decoding the JWT (`jwt.io`) and checking the `organization_id` claim is present. Service-role client bypasses RLS: use for gateway + audit + manifest paths only, never user-facing routes.
3. **`.parse()` in a route handler will crash the server on bad input.** Always `.safeParse()`. No exceptions.
4. **`getSession()` can be spoofed.** Use `getUser()`: it hits the auth server and validates the JWT.
5. **SSE transport is deprecated.** Use HTTP-Streamable only.
6. **JWT tokens in tests are still secrets.** Never hardcode them, even "for local dev". Scanners will flag them.
7. **Unknown MCP methods should return `-32601`.** Not silently succeed, not crash.
8. **Origin URLs are SSRF vectors.** User pastes `http://169.254.169.254/` and you leak cloud credentials. Run every URL through the guard.
9. **Next.js caches GET handlers by default.** `export const dynamic = 'force-dynamic'` on anything user-specific.
10. **React 19 requires `useRef(null)`.** The old `useRef()` signature is gone.
11. **Never develop against hosted Supabase.** `.env.local` gets values from `pnpm supabase start`, not from the hosted dashboard. Hosted is prod; schema churn belongs on the local Docker stack. Push to hosted via `supabase db push` only before a real deploy.
12. **Supabase 2026 key format parity.** Local `supabase start` emits the same `sb_publishable_*` / `sb_secret_*` format as hosted projects. Use canonical env names (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`); the legacy `ANON_KEY` / `SERVICE_ROLE_KEY` names still work but are deprecated.
13. **Port 54322 conflict = another Supabase stack running.** `pnpm supabase stop --project-id <other>` stops it without data loss (Docker volumes persist). Don't change ports unless you need both stacks concurrently.
14. **Infra setup belongs in sprint 1, not demo day.** Vercel + Marketplace integration is one-shot and <30 min. Deploying early surfaces prod-only failures during iteration, not at submission.
15. **Anthropic `mcp-client-2025-11-20` beta requires `mcp_toolset` pairing in `tools`.** Defining `mcp_servers` alone returns 400. Add `{ type: 'mcp_toolset', mcp_server_name: '<name>' }` in the `tools` array matching the server name exactly.
16. **Vitest doesn't auto-load `.env.local`.** Inline a tiny dotenv parser at the top of `vitest.config.ts` (before `defineConfig`): shell-source can miss vars that fail POSIX parse, and worker processes don't always see main-process env mutations.
17. **Idempotent migrations unblock first-production `supabase db push`.** `drop constraint if exists`, `where not exists` guards on INSERTs, empty-case-safe DO blocks. Without them, the first push to hosted runs against a partial state and fails loudly.
18. **Next.js 16 `useSearchParams` requires a Suspense boundary in client pages.** `export const dynamic = 'force-dynamic'` does NOT fix it: v16 is stricter than v15. Canonical fix: split the hook-using form into its own client component, wrap it in `<Suspense>` inside a server page. `tsc --noEmit` + `pnpm test` both pass the broken setup; only `pnpm exec next build` catches it. Always run `next build` on any `app/` page change.
19. **Run opt-in test flags before committing code they gate.** `VERIFY_REAL_PROXY=1`, `VERIFY_ANTHROPIC=1`, `VERIFY_INTEGRATIONS=1`. Defaults skip them for CI speed, but if the diff touches their scope, the gated tests are the only coverage: skipping them hides regressions until demo day.
20. **Gateway governs the CALL, downstream governs the DATA.** Policies that duplicate Salesforce Approval Processes / SAP Workflow / ServiceNow CAB / agent-framework cost budgets add zero and pull focus. If agent frameworks or downstream systems have better visibility into the thing, it's not the control plane's policy. Principle cemented Sprint 9 after nearly shipping `budget_cap`; see CLAUDE.md § Key Decisions.
21. **Next.js 16 treats `_`-prefixed folders as private and excludes them from routing.** An ops endpoint at `app/api/_internal/manifest/invalidate/route.ts` 404s silently at every environment: the underscore makes the whole folder a build-time private folder (no route emitted). Use `app/api/internal/...` + runtime env gate (`NODE_ENV === 'production' && !MANIFEST_INTROSPECTION_ENABLED`) inside the handler instead. `tsc` + `lint` + `test` all pass the broken setup; only `pnpm exec next build`'s route table reveals the missing route. Caught Sprint 12 WP-G.18.
22. **Background-subagent `completed` notifications can fire on premature exit.** Sprint 13 Subagent B (Monitoring page, 7 spec'd files) reported DONE with only 2 files written; its final transcript line was "### Step 2: Create `lib/monitoring/fetch.ts`": it bailed mid-work but was marked complete anyway. Verify before trusting: `git status --porcelain` shows expected untracked files, `pnpm test` pass count matches the expected delta from the prompt (always specify "baseline → expected"), `pnpm exec next build` route table shows new routes. If any mismatch, re-dispatch with explicit finish prompt or complete in main thread. Never proceed to combined code-review on unverified subagent output.
23. **Co-deployed MCP routes need `SSRF_ALLOW_LOCALHOST=1` in dev.** Sprint 15 C.6 moved SF/Slack/GitHub proxies to in-process routes at `app/api/mcps/<vendor>/route.ts`. The gateway's `proxyHttp` roundtrips `origin_url` through `safeFetch` to keep the "same contract as external" property. In dev, `origin_url` is `http://localhost:3000/...` which the SSRF guard blocks by default. Set `SSRF_ALLOW_LOCALHOST=1` in `.env.local` to allow it. Flag stays UNSET in production: Vercel `origin_url` is the live HTTPS domain, the guard accepts it, no exception needed. Document the flag's dual use (vitest + dev-mode co-deployed MCPs) in `lib/security/ssrf-guard.ts::validateUrl`.
24. **Parallel Edit `replace_all` + overlapping indent levels produce duplicate-key bugs.** Sprint 15 K.1 ran two `replace_all` passes on `lib/mcp/stateless-server.ts` to insert `organization_id: scope.organization_id,` after every `trace_id: traceId,`. The 6-space pattern is a literal substring of the 8-space line, so the second pass matched inside the lines the first pass already modified: producing a duplicate `organization_id` property and tripping TypeScript TS1117. Two fixes: (a) anchor indent by including the newline prefix in the match (`\n      trace_id:` not `      trace_id:`), or (b) run the more-indented pattern FIRST, then the less-indented pattern only matches its native sites. Caught the hard way: 3 follow-up edits to collapse the duplicates.
25. **Supabase migration filenames MUST be 14-digit `YYYYMMDDHHMMSS_*.sql`.** Hyphenated prefixes (`20260424-02_foo.sql`) are silently skipped by the CLI: no warning, just ignored at `db reset` and `db push`. Cost ~30 min Sprint 15 chasing "why doesn't my migration apply". Codified as `.claude/rules/migrations.md`.
26. **Supabase `custom_access_token_hook` dashboard registration isn't migratable.** Shipping the function via SQL is only half the work: on hosted, the hook must be explicitly enabled via dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims hook". No API or migration path. Local uses `supabase/config.toml` `[auth.hook.custom_access_token]` block. After `supabase db push` on any migration that installs the function, the live app is in a broken state (RLS active + empty claim = empty dashboard) until the dashboard toggle fires. Budget ~30 seconds for the dashboard step every time RLS schema lands on hosted.
27. **RLS `WITH CHECK` must pin every scope-defining column, not just row ownership.** A policy with `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` lets a user `UPDATE row SET organization_id = '<victim>'` because post-update the row is still theirs. WITH CHECK needs `AND organization_id = public.jwt_org_id() AND role = '<immutable>'` to lock the scope columns to their tamper-proof sources (JWT claim). Caught by reviewer on Sprint 16 WP-L.1 `member_update_self`; fix shipped as follow-up migration `20260425160000_rls_member_update_tighten.sql`.
28. **Vercel preview deployments 401 auth routes.** Preview URLs (`<project>-<branch>.vercel.app`) have "Deployment Protection" on by default: every path returns 401 without a Vercel login or bypass token. Includes `/auth/callback`. Supabase email verification redirects there → user never gets session established → lands on landing page confused. For auth flow testing, always use the production URL (`<project>.vercel.app`) where protection is off. Or disable protection in Vercel project settings.
29. **Supabase built-in SMTP is locked at 2 emails/hour/project.** The "Rate limit for sending emails" field is greyed out in the dashboard until you configure a custom SMTP provider (Resend, SendGrid, Postmark). For signup iteration (sign up → verify → fix → delete → re-sign-up), 2/h is brutal. Dev workaround: disable "Confirm email" under Auth → Providers. Production: configure Resend (free tier 100/day, 5-min DNS setup). Sprint 16 signup testing hit this.
30. **Parallel subagents MUST use worktree isolation or they clobber each other.** Without `isolation: worktree` in the subagent's frontmatter, all parallel subagents share the main session's working tree. One subagent's `git stash` + `git checkout stash@{0} -- <my-files>` dance (a common "isolate my changes during baseline verification" pattern) drops every sibling's stashed state. Sprint 17 subagent 17.4 wiped 17.2's shipped migration + route + UI filter changes this way. Fix: `.claude/agents/general-purpose.md` with `isolation: worktree` in frontmatter: every spawn of the default write-capable subagent auto-isolates at `.claude/worktrees/<name>` branched off `origin/HEAD`. Merge is manual: main session runs `git merge worktree-<name>` per subagent after all return. `code-reviewer` stays shared-tree (needs `git diff --cached` from main). `.worktreeinclude` at repo root lists gitignored files (`.env.local`, `.env`) to copy into worktrees so `pnpm supabase` + integration tests work inside the isolated checkout. `cleanupPeriodDays: 7` in `.claude/settings.json` auto-prunes stale worktrees. See CLAUDE.md § Parallel Work for the full merge contract.
31. **post-edit-check hook serializes parallel subagent Writes on intermediate lint states.** The hook runs `pnpm lint` + `tsc --noEmit` project-wide after every Edit/Write. When multiple subagents share one working tree, one subagent's intermediate "added prop but not yet wired" state introduces unused-import errors that block every other agent's next Write project-wide: effectively serializing what was supposed to be parallel. Two fixes, not mutually exclusive: (a) use worktree isolation (per lesson #30) so each subagent lints its own checkout; (b) subagent prompts explicitly mandate atomic multi-statement edits ("wire imports + prop + JSX in a single Edit call so the file never sits in an unused-import state"). Fix #a is canonical; fix #b is belt-and-braces for when the hook still fires.
32. **Hosted migration drift is invisible until end-to-end deploy test.** A migration committed to `main` + applied locally via `pnpm supabase db reset` can sit un-pushed to hosted for weeks with no symptom. Sprint 17 WP-17.2 shipped `20260425170000_gateway_tokens_kind.sql` + route code reading the new `kind` column in the same commit: but never ran `pnpm supabase db push`. Sprint 18.3 deploy-test token-mint → PG rejected unknown column → API returned `{error:'create failed', details:<pg_msg>}` → client toast surfaced only `'create failed'`. Two-layer hide: missing push + generic-error client that ignores `details`. Fix is process, not code: `pnpm supabase migration list --linked` is now a wrap-sprint hard gate in `.claude/rules/migrations.md` § Sprint wrap. Local == Remote row-for-row before closing any sprint that touched `supabase/migrations/`. Secondary fix (deferred to BACKLOG): dev/staging API responses include `details` in the toast-visible path so Postgres errors aren't two layers away from the user.
33. **MCP envelope unwrap at capture bag.** In-process HTTP-Streamable MCPs (SF/Slack/GitHub under `app/api/mcps/<vendor>/`) return `{content:[{type:"text", text:"<JSON>"}]}`. `lib/mcp/proxy-http.ts::extractResult` already strips the outer `{content:...}` wrapper: so what reaches `execute-route.ts` in `postResult` is a BARE ARRAY `[{type:"text",...}]`, NOT the wrapped form. Without an unwrap at the capture bag, `$steps.<key>.result.<field>` DSL traversal hits array index 0 (the `{type:"text"}` part), walks into undefined, throws. Every cross-step `input_mapping` and `rollback_input_mapping` breaks for in-process MCPs. OpenAPI proxies return unwrapped bodies, so they weren't affected: the bug hid until Sprint 15 C.6 moved vendor MCPs in-process. Fix: `lib/mcp/route-utils.ts::unwrapMcpEnvelope()` handles BOTH shapes defensively (bare array + wrapped `{content:...}`), JSON-parses inner text, falls through to raw text if non-JSON. Applied at both `captureBag[...] = { args, result: unwrapMcpEnvelope(postResult) }` sites (forward + fallback) in `execute-route.ts`. Shipped Sprint 19 WP-19.9.
34. **Proven-negative integration tests.** A regression test that passes both WITH and WITHOUT the fix proves nothing. Sprint 19 validated the envelope-unwrap integration test by temporarily reverting the single-line fix, re-running, confirming failure with the exact regression error (`expected undefined to be 'acc_env'`), then restoring. Only after proving the test catches the regression did it get staged as a permanent guard. Separate from TDD's red-green (which starts from red): proven-negative retrofits validation onto existing bug fixes. Also exposed in Sprint 19: unit tests alone are insufficient when the helper sits at a boundary between layers: the first `unwrapMcpEnvelope` iteration passed 6 unit tests AND an integration test because both used the shape the author assumed, not the shape upstream actually produced. Only the live E2E against real SF/Slack/GitHub surfaced the mismatch. Rule: when a helper wraps unknown upstream shape, always verify at unit → integration → live tiers before declaring done.
35. **`auth.updateUser` does not refresh the JWT.** `supabase.auth.updateUser({data: ...})` updates `auth.users.raw_user_meta_data` and returns the new User object, but does NOT re-issue the access token: so the `custom_access_token_hook` doesn't re-run, and the cookie keeps the stale claim values until natural expiry (default 1h). Symptom Sprint 20 WP-20.1: fresh signup → fill onboarding form → server action UPDATEs `memberships.profile_completed=true` → returns `{ok:true}` → `router.push('/dashboard')` → `proxy.ts` reads stale JWT → bounces back to `/onboarding`. DB shows the flip, cookie still says false. Fix: explicit `auth.refreshSession()` in the action AFTER the DB writes and AFTER `updateUser`. The SSR client's `setAll` cookie callback writes the refreshed JWT into the response cookies so the next request carries fresh claims. Generalizes: any DB mutation that should reflect into JWT claims requires `refreshSession()`, not `updateUser` alone.
36. **React `cache()` is the canonical Supabase auth dedup primitive: and it's a no-op in vitest.** Without it, every `requireAuth()` call (layout + page + helpers) fires a fresh `supabase.auth.getUser()` over the network. Typical dashboard nav: 3-4 round-trips × ~200ms = ~1s of pure auth latency before any data renders. Wrap with React's `cache()` (Server-Component-only API): all callers within one RSC render request share the result, no API change for callers. Server Actions from the same render share the cache too. Caveat: `cache()` only dedupes inside an actual RSC render: vitest tests run outside that context and observe `cache()` as a fallthrough. Means you CAN'T unit-test the dedup behavior. Use contract tests: source-introspection regex on the wrap presence + an invocability test that the wrapped function still throws on bad auth. Production verification = manual (devtools network panel, one `getUser` per nav). Shipped Sprint 20 WP-20.2 in `lib/auth.ts`.
37. **shadcn `inset` variant collapses without color contrast OR explicit border.** When `--background` and `--sidebar` are both pure black (or any identical color), the inset variant's `rounded-xl` + `shadow-sm` are invisible: there's nothing to cast the shadow against and the rounded corners blend into the wrapper bg. Two fixes, often combined: (a) differentiate the CSS tokens: `--sidebar` for the chrome rail, `--background` for the content card, with at least 5-10% lightness delta; (b) add `border` className to `SidebarInset` to surface a faint 1px outline using `--border` (typically `oklch(1 0 0 / 10%)` on dark themes). Sprint 21 shipped both: muted-main / pure-black-chrome plus `border overflow-hidden`. The `overflow-hidden` is non-obvious: without it, child `bg-sidebar` strips (the SiteHeader on top of the inset) extend past the rounded corners with flat edges and ruin the silhouette. Always pair `border + rounded-*` with `overflow-hidden` when child elements have their own bg.
38. **`router.refresh()` only re-runs the RSC tree: client-state effects don't trigger.** Server Components and the values they fetch refresh; `useState`/`useEffect`-fetching client components keep their stale state. Symptom Sprint 21 WP-21.5: KPI cards (RSC-fetched) updated on tab return but the Gateway Traffic chart (client component with its own `/api/gateway-traffic` fetch in `useEffect`) didn't, even though `router.refresh()` was called. Fix: parallel broadcast: alongside `router.refresh()`, dispatch a `window.CustomEvent('semgps:dashboard-refresh')`, and have client-state components subscribe with `addEventListener` + bump a `refreshTick` state that's in their fetch effect's deps array. Single hook (`useDashboardRefresh`) owns both paths so callers don't need to know about the dual mechanism. Important for any dashboard mixing RSC-fetched and client-fetched data: common when a chart component pre-existed as a client widget but the surrounding cards are pure RSC.
39. **Supabase Realtime needs explicit `setAuth(session.access_token)`: `@supabase/ssr` cookie hydration alone doesn't carry the JWT to the websocket.** Symptom Sprint 22 WP-22.1: `postgres_changes` channel reports `SUBSCRIBED` successfully but receives ZERO events. Diagnosis from outside the box looks impossible: no error, no warning, just silent dead air. Root cause: HTTP requests pick up auth from the cookie via `setAll` callback; the realtime websocket subscribes with whatever JWT was set at client init (often empty when the SSR client constructs cookieless). RLS on `mcp_events` evaluates as anon → fanout drops every event before it leaves the server. Fix is a two-step handshake: `await supabase.auth.getSession()` → `await supabase.realtime.setAuth(session.access_token)` → THEN `.channel(...).on('postgres_changes', ...).subscribe()`. Mount-once pattern in a singleton hook (`useRealtimeDashboardEvents`) at the dashboard shell. Required pair: `ALTER TABLE public.<table> REPLICA IDENTITY FULL` so the replication stream carries the columns the RLS policy reads: DEFAULT replica identity sends only the PK, and RLS filtering on `organization_id = jwt_org_id()` needs that column visible. Without `REPLICA IDENTITY FULL`, even with `setAuth` fixed, channel still drops every event. Trade-off: full pre-image to WAL on UPDATE/DELETE: negligible for INSERT-only audit tables. For long-lived sessions with token rotation, also re-call `setAuth` on `auth.onAuthStateChange` TOKEN_REFRESHED events (deferred to BACKLOG; not needed for hackathon-length sessions). Shipped Sprint 22 WP-22.1.
40. **Saga compensator must follow the fallback target on rollback: `fallback_tool_id` + `fallback_rollback_input_mapping`.** When a step's `fallback_to` edge succeeds (primary tool errored → fallback tool executed and succeeded), the captured result AND the compensator semantics belong to the FALLBACK TARGET, not the primary tool. Naive saga rollback picks `compensated_by` from the primary tool's id and orphans the fallback's artifacts. Concrete failure Sprint 22 first E2E: step 4 primary `chat_post_message` errored → fallback `create_issue` succeeded → real GH issue #17 created. Step 5 errored → rollback walked back. Rollback for step 4 picked `chat_post_message → delete_message` (primary's compensator). Slack received `delete_message` with no real channel/ts → upstream_jsonrpc_error. GH #17 left orphaned. Fix is two pieces, BOTH needed: (a) `ExecuteRouteFallbackUsed` payload gains `fallback_tool_id` so `executeRollback` picks the compensation edge from `stepEntry.fallback_used.fallback_tool_id` instead of `planPair.tool.id` when fallback was used; (b) new `route_steps.fallback_rollback_input_mapping jsonb` column: mirror of `rollback_input_mapping` for the fallback path. Translates the fallback target's captured result into ITS OWN compensator's input shape via the same `resolveInputMapping($mapping, inputs, captureBag)` primitive. Mapping precedence: `fallback_rollback_input_mapping` (when `fallback_used`) → `rollback_input_mapping` → producer's result verbatim. Verified E2E re-run: `compensated_count: 2, failed_count: 0`. Both GH #18 (primary step 3) AND GH #19 (fallback at step 4) closed by `close_issue`. Zero orphans. Migrations: `20260425240000_route_step_fallback_input_mapping.sql` + `20260425250000_route_step_fallback_rollback_input_mapping.sql`. Shipped Sprint 22 WP-22.4 follow-on.
41. **Dodge `react-hooks/set-state-in-effect` via prop-keyed derived state.** Lint rule rightly flags synchronous setState inside `useEffect` body: they cause cascading renders. The "reset state when prop changes" pattern naturally violates it (`if (eventId === null) setDetail(null)` inside the effect). Canonical dodge: store a discriminator IN the state (the prop value the state was fetched for) and derive freshness via comparison. Three derived booleans replace the imperative resets: `isStale = detail !== null && detail.id !== currentProp`, `showDetail = currentProp !== null && !isStale && detail !== null`, `showError = currentProp !== null && error?.id === currentProp`. Async fetch captures `targetId = currentProp` at effect entry, sets state via `setDetail({ id: targetId, ...payload })`. A `cancelled` flag in cleanup blocks setStates from in-flight stale fetches when prop switches rapidly (A → B → A). Properties: zero sync setState in effect body (lint clean), no flash of stale data on prop change, race-safe on rapid switches. Smallest valid change for "fetch when prop changes" effects without rewriting to TanStack Query / SWR. Shipped Sprint 22 WP-22.2 in `components/dashboard/audit-detail-sheet.tsx`.
42. **Recharts `barCategoryGap={N}` numeric collapses stacked bars to ~0.04px.** Documented as pixels but interacts badly with stacked bars sharing one `stackId`: bar widths render at ~0.04 SVG units and the chart looks empty despite non-zero data. Symptom Sprint 23 monitoring: 24h view showed empty canvas; SVG inspection (`document.querySelectorAll('.recharts-bar-rectangle path')[i].getAttribute('d')` → `M648.79,190.08 L 648.83,190.08 ...` width 0.04) revealed the collapse. Fix: drop the explicit `barCategoryGap` (and `maxBarSize`) overrides: recharts default `'10%'` (string-percent) divides correctly across categories regardless of stack count. Stripped from all 4 bar charts; bars rendered at expected widths. Lesson: only override these when you've measured a problem the defaults cause. Going beyond defaults to "fix" fat-and-lonely bars (real fix is more buckets via shorter range) introduced the bug. Diagnostic tool: Playwright `browser_evaluate` returning `getBoundingClientRect()` widths: visual screenshot wouldn't have surfaced "0.04px wide" directly.
43. **React 19 `react-hooks/purity` lint rule blocks `Date.now()` in render.** Common breakage point: client-side time-bucketing components computing `nowMs = Date.now()` inside a `useMemo`. Lint flags impure functions called during render. Canonical fix: bucket on the SERVER, render dumb data. Pure function `bucketX(events, range, nowMs = Date.now())` in `lib/<domain>/timeline.ts`: default arg makes it server-callable without props. Server route calls with `nowMs = Date.now()` (Node.js context, no purity rule). API response includes pre-formatted `series: Bucket[]` with `dateLabel` baked in. Client component receives `series` prop, renders directly: zero `Date.now()` in render path. Bonus: server-side bucketing centralizes time semantics: range vocabulary, label format, anchor logic in one file (`lib/monitoring/range.ts`). Client and unit tests share the pure function via the injectable `nowMs` param. Anti-pattern: tracking `nowMs` state with `useEffect(() => setNowMs(Date.now()), [])`: works but adds a render cycle and lifetime is unclear. Shipped Sprint 23: `lib/audit/timeline.ts::bucketAuditTimeline` + `lib/monitoring/fetch-windowed.ts::fetchMonitoringWindowed`.
44. **Datadog-style auto-range pick on dashboard load.** Default 1h is bad UX: most users hit the page after their last activity rolled outside that window, see "0 of 0 events", and never click further. Industry pattern (Datadog, Honeycomb, Grafana): pick the smallest range whose window contains the latest event. Server-side: `SELECT created_at FROM mcp_events WHERE org=? ORDER BY created_at DESC LIMIT 1` → `pickAutoRange(latestEventMs, nowMs)` walks `MONITORING_RANGES` ascending, returns first whose `windowMs >= ageMs`. Falls back to `'7d'` for very old events; defaults to `'1h'` when null. Client passes no `range` param on first fetch → server picks → response carries chosen `range` → client `setRange(body.range)`. User picks override + are sticky. Client state: `useState<MonitoringRange | null>(null)` (null = "let server decide"). Picker briefly empty until first response (~50ms). Cleaner than tracking a separate `hasLoaded` flag. Cost: one extra `LIMIT 1 ORDER BY created_at DESC` per first-load: negligible at any scale. Shipped Sprint 23 in `lib/monitoring/range.ts::pickAutoRange + fetchLatestEventMs`, consumed by both `/api/audit` and `/api/monitoring`.
45. **`NEXT_PUBLIC_APP_URL` is a stale-tunnel footgun for any user-copyable URL surface.** Connect page snippets + `server-config-snippet.tsx` both leaked old cloudflared tunnel URLs from `.env.local` long after the tunnel died: copy-paste produced `ERR_NAME_NOT_RESOLVED` for the user. Canonical pattern: `useSyncExternalStore(subscribeNoop, () => window.location.origin, () => '')` so the displayed origin always matches the host the user is on (localhost in dev, Vercel domain on hosted, tunnel only when on the tunnel). Server snapshot returns `''` for hydration-safe SSR: first paint shows path-only, hydration swaps in the real value. Avoids `set-state-in-effect` lint rule (no `useState + useEffect(() => setOrigin(...), [])` dance). Same-origin in-browser fetches (e.g. Connect's "Test connection") use the relative path so they work regardless of host. Shipped Sprint 24 (Connect page, `6ccfa89`) and Sprint 25 (`server-config-snippet.tsx`).
46. **SiteHeader is pure chrome; main content owns the page `<h1>`.** Sprint 24 fix to a duplicate-title regression: SiteHeader (`components/site-header.tsx`) used to render `<h1>{title}</h1>` derived from a `TITLES` map by pathname, while every page also had its own `<h1>` in main content: every dashboard page rendered the title twice. Removed the SiteHeader title path entirely (also dropped `usePathname`, `Separator`, `TITLES`, `resolveTitle`). Strip is now: SidebarTrigger + brand cluster ("Built with Opus 4.7" pill + org name) + RefreshButton. Hooks (`useDashboardRefresh`, `useRealtimeDashboardEvents`) stay because they're singletons mounted at the dashboard shell. Consequence: when adding a NEW dashboard page, ensure main content has its own `<h1>`: don't expect chrome to label it. Pattern matches Linear/Vercel/Stripe (chrome contains no page-specific labels).
47. **Server health derived from event status mix beats N parallel live probes.** Sprint 25 servers list page: instead of N `/api/servers/[id]/health` calls on render (one per card), do a single batched `mcp_events` SELECT filtered by `organization_id` + `server_id IN (<list>)` + `created_at >= now()-24h`. Bucket by `server_id` in JS, count `status NOT IN ('ok', 'blocked_by_policy')` as errors. Health derivation: `unknown` (0 calls) | `down` (errors >= calls) | `degraded` (some errors) | `ok` (none). Trade-off: stale by ~refresh interval (router.refresh on tab focus = good enough for list view). Live probe stays available on detail page where health-now matters. Status slice for "errors" is conservative: treats `unauthorized`, `fallback_triggered`, `invalid_input` as errors; could narrow to `origin_error` only for tighter signal but threshold + low traffic prevents nuisance "down" badges in practice.

---

## Day-1 Checklist

Before writing any business logic:

- [ ] `pnpm create next-app` (App Router, TypeScript, Tailwind, ESLint: say no to src/ dir)
- [ ] `pnpm add @supabase/supabase-js @supabase/ssr zod @modelcontextprotocol/sdk @anthropic-ai/sdk`
- [ ] `pnpm add -D vitest @vitest/ui`
- [ ] Install shadcn-ui or hand-roll Radix primitives in `components/ui/`
- [ ] Create hosted Supabase project (production target) + run `pnpm supabase start` locally (dev target). Paste **local** stack keys into `.env.local`
- [ ] Generate `CREDENTIALS_ENCRYPTION_KEY` with `openssl rand -base64 32` and paste into `.env.local`
- [ ] `pnpm supabase link --project-ref <ref>` to wire the CLI to hosted for eventual deploy
- [ ] Link Vercel to the GitHub repo + install Supabase Marketplace integration for auto-injected env vars
- [ ] Apply schema migration from this doc
- [ ] Write `lib/supabase/{server,client,service}.ts`
- [ ] Write `lib/auth.ts` with `requireAuth()` helper
- [ ] Write `proxy.ts` for Supabase session refresh (NOT `middleware.ts`)
- [ ] Write `lib/security/ssrf-guard.ts`: block RFC1918 ranges plus `127.0.0.0/8` and `169.254.0.0/16`
- [ ] Scaffold `app/api/mcp/route.ts` returning a hard-coded `tools/list` response so the gateway URL is live from hour 1

Once those are in place, every subsequent day builds on a known-good base.

---

## What Not To Touch

If a 5-day clock is ticking and you find yourself considering any of these, say no:

- OAuth/SSO providers
- MFA, device tracking, session management UI
- Custom email templates
- Rate limiting beyond the most trivial in-memory limiter
- Billing, usage metering
- i18n
- Dark/light theme toggle (pick one and commit)
- Unit tests for UI components
- Any abstraction over Next.js, Supabase, or the MCP SDK

Every one of these costs half a day for zero demo impact. Ship the wedge.
