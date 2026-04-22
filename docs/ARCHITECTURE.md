# Semantic GPS — Architecture (Hackathon MVP)

This document is the operating manual for the 5-day hackathon build. Everything here is decided. Deviations need a reason.

Companion to `PROJECT.md` (scope, features, demo plan).

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | **Next.js 16 (App Router)** | Server Components + Route Handlers in one codebase; zero-config Vercel deploy |
| Language | **TypeScript (strict mode)** | No `any`, no `@ts-ignore`. Fix the type. |
| Database | **Supabase (Postgres)** | Local-first dev via `pnpm supabase start` (Docker stack); hosted for prod. Auth + realtime in one dashboard. Free tier is enough for hackathon. |
| Auth | **Supabase Auth (email/password)** | `getUser()` server-side. Never `getSession()`. |
| MCP SDK | **@modelcontextprotocol/sdk** | HTTP-Streamable transport. SSE is deprecated — don't use it. |
| Validation | **Zod** | `.safeParse()` at every boundary. Never `.parse()` in routes. |
| UI primitives | **Radix UI + Tailwind CSS** | Accessible + fast to style. |
| Graph viz | **React Flow** | Workflow graph with drag-to-pan and click-to-inspect. |
| Icons | **Lucide** | Consistent, tree-shakeable. |
| Toasts | **Sonner** | Use `toast()` — never `alert()` or `console.log()`. |
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
│   ├── (auth)/                  # Route group — login, signup
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── auth/                # Login/signup handlers (wraps Supabase)
│   │   ├── mcp/
│   │   │   └── route.ts         # THE gateway endpoint — MCP + TRel
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
│   │   └── audit/page.tsx       # Event stream + replay by trace_id
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
│   │   └── service.ts           # Service role — MCP proxy route ONLY
│   ├── mcp/
│   │   ├── stateless-server.ts  # Fresh McpServer per request
│   │   ├── trel-handlers.ts     # discover_relationships, find_workflow_path, validate_workflow
│   │   ├── trel-schemas.ts      # Zod schemas for TRel methods
│   │   └── types.ts             # MCP + TRel shared types
│   ├── manifest/
│   │   ├── cache.ts             # In-memory cache + load from DB
│   │   └── invalidate.ts        # Called after ANY mutation touching servers/tools/policies/relationships
│   ├── policies/
│   │   ├── built-in.ts          # PII, rate-limit, allowlist, injection-guard — JSON config per policy
│   │   └── enforce.ts           # enforceOrShadow() wrapper
│   ├── openapi/
│   │   └── to-tools.ts          # OpenAPI 3.x → MCP tool descriptors
│   ├── crypto/
│   │   └── encrypt.ts           # AES-256-GCM for stored credentials (server auth_config)
│   ├── audit/
│   │   └── logger.ts            # logMCPEvent — fire-and-forget
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
└── .env.local                   # Gitignored — see env section below
```

---

## Database Schema (MVP)

Multi-tenant-ready, RLS off for now. `organizations` + `memberships` hold tenancy; every domain table FKs back to an org. Single-admin role for MVP, V2 expands the enum.

```sql
-- Organizations: one per signup (admin's workspace)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Memberships: user ↔ org with role. MVP locks role to 'admin'.
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
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
  auth_config JSONB,             -- Bearer tokens / API keys — AES-256-GCM encrypted via lib/crypto/encrypt.ts
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
    'pii_redaction', 'rate_limit', 'allowlist', 'injection_guard'
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

-- Audit log: every gateway interaction
CREATE TABLE mcp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,        -- Correlate hops in a workflow
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
CREATE INDEX idx_tools_server ON tools(server_id);
CREATE INDEX idx_relationships_from ON relationships(from_tool_id);
CREATE INDEX idx_relationships_to ON relationships(to_tool_id);
```

**RLS off for MVP.** Single-org, single-user-per-demo. Revisit for V2.

---

## API Surface

### Public (MCP Gateway)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/mcp` | MCP JSON-RPC endpoint. Handles `initialize`, `tools/list`, `tools/call`, plus TRel extensions `discover_relationships`, `find_workflow_path`, `validate_workflow`. |

### Dashboard (auth-gated)
All endpoints org-scope via `requireAuth()` → `organization_id`. Every read filters by the caller's org, every insert pins the row to it.

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/servers` | CRUD MCP server registrations (org-scoped) |
| POST | `/api/openapi-import` | `{ url }` → auto-create server + tools |
| GET/POST/DELETE | `/api/relationships` | CRUD graph edges |
| GET/POST/PATCH/DELETE | `/api/policies` | Built-in refs + JSON config |
| POST/DELETE | `/api/policies/:id/assignments` | Attach policy to server/tool |
| GET | `/api/audit` | Query events for dashboard (filterable by trace_id, status, time range) |
| POST | `/api/auth/login` | Supabase email/password login |
| POST | `/api/auth/signup` | Signup (single-user mode — could even disable after first signup) |

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

---

## Non-Negotiable Conventions

These are the rules. They come from hard lessons in the original build — skip them and you'll debug for hours.

### TypeScript
- `strict: true`. No `any`. No `@ts-ignore`. No `as any`.
- Catch variables are `unknown`. Narrow: `e instanceof Error ? e.message : String(e)`.
- `useRef(null)` — React 19 requires an initial value.
- Never `!` non-null assertions. Use `?.` and `??`.

### Zod
- `.safeParse()` in route handlers. Never `.parse()`.
- Return `result.error.flatten()` in 400 responses.
- `z.coerce.number()` for query params.

### Supabase
- `supabase.auth.getUser()` for auth. Never `getSession()` — it can be spoofed.
- **User-scoped client** (`lib/supabase/server.ts`) in any route with a user session.
- **Service role client** (`lib/supabase/service.ts`) ONLY in the MCP gateway route (no user session there).
- Check `{ error }` — Supabase errors are returned, not thrown.
- `.single()` only when you expect exactly one row. Else `.maybeSingle()`.

### Next.js
- Server Components default. `"use client"` only when you need state, effects, or handlers.
- Never import `lib/supabase/server.ts` in a client component.
- `export const dynamic = 'force-dynamic'` on GET handlers that return user-specific data.
- `await params` — Next.js 16 params are async.
- ⚠️ Next.js 16 uses `proxy.ts`, **not** `middleware.ts`. If both exist, build fails. Export `proxy`, not `middleware`.

### Git
For a 5-day hackathon, keep it simple:
- `main` + `feature/*` branches
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- No develop branch, no 3-tier flow. Ship straight to main.
- Commit every meaningful slice — demo rollback is a superpower.

### Code style
- `const` over `let`, never `var`
- Arrow functions for components and callbacks
- Named exports, not default
- Early returns over nested conditionals
- Template literals over string concat
- `cn()` utility (clsx + twMerge) for conditional Tailwind
- Mobile-first responsive
- PascalCase component files, kebab-case directories, `use-*.ts` for hooks

---

## Security Baseline (Non-Negotiable)

Even for a hackathon — a single embarrassing incident kills the pitch.

- **SSRF guard on every outbound fetch.** `lib/security/ssrf-guard.ts`. Block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16) before any connection. Required for OpenAPI import and any user-supplied URL.
- **Encrypt stored credentials at rest.** Bearer tokens, API keys, and anything written to `servers.auth_config` passes through `lib/crypto/encrypt.ts` (AES-256-GCM). Plaintext in Postgres = table dump = game over.
- **Never hardcode secrets.** Read from `process.env`. Even in tests — use `process.env.X ?? ''`, never inline.
- **Never trust MCP tool arguments.** Validate every `tools/call` payload against the tool's `inputSchema` with Zod before proxying.
- **Never log credentials or secrets.** `logMCPEvent` uses `redactPayload()` to strip known secret patterns before write.
- **Zod `.safeParse()` at every API boundary.** Public endpoints are public — validate everything.

---

## Environment Variables

Create `.env.local` (gitignored) with:

```bash
# Supabase (new 2026 key format: sb_publishable_* / sb_secret_*)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...            # Server only — never expose

# Anthropic for demo agent
ANTHROPIC_API_KEY=<your-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000    # Used for invite links, callbacks

# Credential encryption — AES-256-GCM key for stored server auth_config
CREDENTIALS_ENCRYPTION_KEY=<base64-32-bytes> # Generate once: `openssl rand -base64 32`
```

For Vercel deploy, set these in the project settings — never commit them.

---

## Dev Setup

```bash
# One-time
pnpm install
pnpm supabase login                 # Browser OAuth, caches token
pnpm supabase link --project-ref <ref>  # Wire CLI to hosted project (deploy path)

# Daily
pnpm supabase start                 # Local Docker stack on :54321 (required — never dev against hosted)
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

Hackathon scope — don't over-test, don't under-test.

**Do test:**
- OpenAPI → MCP tool conversion (pure function, many edge cases)
- TRel handlers: `discover_relationships`, `find_workflow_path`, `validate_workflow` (they're the demo)
- `enforceOrShadow` decision logic — correct matching, enforce vs shadow
- Credential encrypt/decrypt round-trip (irreversible damage if this ever breaks)

**Skip for MVP:**
- E2E (Playwright) — you'll demo live
- Integration tests against real DB — too much setup
- UI component tests — you'll see them in the demo

File convention: `__tests__/*.vitest.ts`. Run with `pnpm test`.

---

## Deployment

- **Web:** Vercel — live at https://semantic-gps-hackathon.vercel.app/. Auto-deploy on push to `main`.
- **Env injection:** Supabase Marketplace integration on Vercel auto-syncs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` from the linked hosted project. `ANTHROPIC_API_KEY`, `CREDENTIALS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` are added manually in Vercel project settings (all environments).
- **DB:** Supabase hosted (`cgvxeurmulnlbevinmzj`, Central EU). Free tier is fine for hackathon traffic. Push migrations via `pnpm supabase db push` — only before a real deploy.
- **Demo agent:** Can run locally pointing at the deployed gateway, or embedded in the dashboard as a "try it" panel.

---

## Hard-Won Lessons

Things that will silently bite if not explicitly called out:

1. **Manifest invalidation is easy to forget.** Make `invalidateManifest()` the last line of every mutation route. Consider a lint rule.
2. **Supabase RLS silently returns empty results.** If a user update looks like it "worked" but data doesn't change, RLS is blocking. Use service client for user-self-updates where needed.
3. **`.parse()` in a route handler will crash the server on bad input.** Always `.safeParse()`. No exceptions.
4. **`getSession()` can be spoofed.** Use `getUser()` — it hits the auth server and validates the JWT.
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
16. **Vitest doesn't auto-load `.env.local`.** Inline a tiny dotenv parser at the top of `vitest.config.ts` (before `defineConfig`) — shell-source can miss vars that fail POSIX parse, and worker processes don't always see main-process env mutations.
17. **Idempotent migrations unblock first-production `supabase db push`.** `drop constraint if exists`, `where not exists` guards on INSERTs, empty-case-safe DO blocks. Without them, the first push to hosted runs against a partial state and fails loudly.

---

## Day-1 Checklist

Before writing any business logic:

- [ ] `pnpm create next-app` (App Router, TypeScript, Tailwind, ESLint — say no to src/ dir)
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
- [ ] Write `lib/security/ssrf-guard.ts` — block RFC1918 ranges plus `127.0.0.0/8` and `169.254.0.0/16`
- [ ] Scaffold `app/api/mcp/route.ts` returning a hard-coded `tools/list` response so the gateway URL is live from hour 1

Once those are in place, every subsequent day builds on a known-good base.

---

## What Not To Touch

If a 5-day clock is ticking and you find yourself considering any of these, say no:

- RLS policies (single-org, no multi-tenancy)
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
