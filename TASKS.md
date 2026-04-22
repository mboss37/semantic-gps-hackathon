# claude-hackathon — Task Tracker

> Claude: Read at session start. Keep focused — only current state + shipped history matters.
> Completed sprints: keep WPs listed (one line each). Session log: 3 lines max, last 3 sessions.

## Completed Sprints
- **Sprint 1 — Setup:** Next.js 16 + React 19 + Tailwind 4 + ESLint 9 scaffold, core + dev deps, shadcn init (Button), `supabase init`, `.env.example`, vitest smoke test, all quality gates green.
- **Sprint 2 — Infra foundation:**
  - Hosted Supabase project created (`cgvxeurmulnlbevinmzj`, Central EU) — production target only
  - `CREDENTIALS_ENCRYPTION_KEY` generated via `openssl rand -base64 32`
  - Local Supabase stack up (`pnpm supabase start` on :54321); emits `sb_publishable_*` / `sb_secret_*` natively
  - `.env.local` populated with local stack values; `.env.example` + ARCHITECTURE.md migrated to 2026 canonical env naming
  - Supabase CLI linked to hosted project (deploy-only)
  - Migration pipeline proven end-to-end — `20260421173113_bootstrap.sql` applied to local (`db reset`) + hosted (`db push`)
  - Vercel live at https://semantic-gps-hackathon.vercel.app/ — Supabase Marketplace integration auto-injects URL + publishable + secret; encryption key + Anthropic + app URL added manually
  - Process rules locked in CLAUDE.md: local-first Supabase (Off-Limits); pull-from-backlog removes-from-backlog; completed sprints persist WPs
- **Sprint 3 — Core build (spine + gateway + policy swap hero) — closed partial:**
  - 3.1 Spine libs + core schema (6 tables, auth, proxy, SSRF, encrypt, manifest cache, dev-login)
  - 3.2 MCP gateway skeleton — Inspector-verified on Vercel, echo tool round-trip, opt-in Anthropic SDK test
  - 3.3 OpenAPI import + servers CRUD + TRel `discover_relationships` / `find_workflow_path`
  - 3.4 Policy engine + enforce/shadow toggle (PII + allowlist built-ins) + manifest-aware gateway
  - 3.5 Dashboard (shadcn dashboard-01) + MCP direct-import tool discovery + server-card tool chips
  - 3.6 Seed + embedded demo agent — **DEFERRED to Sprint 4 WP-4.18**. Reality check on 2026-04-22 vs. the reference architecture at `/projects/semantic-gps/docs` surfaced that shipping a demo on mocked tool execution, a half-built TRel, and zero real integrations would be a vanity win. Scope got re-drawn.
- **Sprint 4 — Day 1: schema foundation + real proxies (Wed 2026-04-22):**
  - A.1 `organizations` + `memberships` schema + `on_auth_user_created` trigger; `servers.user_id` → `organization_id`
  - B.1 `domains` table + `servers.domain_id` FK; trigger extended to auto-seed default SalesOps domain on signup
  - B.3 Relationship taxonomy migrated to the stories' 8 types (`produces_input_for`, `requires_before`, `suggests_after`, `mutually_exclusive`, `alternative_to`, `validates`, `compensated_by`, `fallback_to`) — CHECK constraint, manifest type, TRel BFS, graph legend, tests all in sync
  - B.4 `policy_versions` audit table with AFTER-INSERT/UPDATE trigger snapshotting every policies mutation
  - C.1 Real OpenAPI HTTP proxy (`lib/mcp/proxy-openapi.ts`) — decrypt `auth_config`, bearer/basic/apikey, path+query+body composition, SSRF-guarded safeFetch, 5xx retry
  - C.2 Real direct-MCP HTTP-Streamable proxy (`lib/mcp/proxy-http.ts`) — JSON-RPC `tools/call` forward, `application/json` or single-event SSE, Zod boundary validation
  - Validations: hosted Supabase migrated via `db push`; Tier 2 real-proxy smoke against httpbin.org green; Tier 1 Opus 4.7 → deployed `/api/mcp` → echo tool E2E in 4.87s. Pre-commit review flow updated (subagent reviews, human approves, main writes marker) to kill tooling false positives.

## Current:
_Sprint closed. Pull Sprint 5 candidates from `BACKLOG.md > Sprint 4+ queue` — dep-unblocked after today: A.2, A.4, A.5, B.2, C.3, C.4, C.5, D.1, D.2, F.4, G.2, G.5, H.1, H.2._

## Session Log
- 2026-04-22 — WP-3.5 shipped (shadcn dashboard-01 + MCP direct-import tool discovery). Reality-check vs `/projects/semantic-gps/docs` → 3.6 deferred, Sprint 4 opened. Architect + PO review of USER-STORIES.md produced 42-WP plan + locked decisions + Playground A/B hero.
- 2026-04-22 — Sprint 4 collapsed to daily-sprint cadence (mega-sprint violated 3-6 sweet spot). Today = 6 day-1 unblockers; other 36 WPs parked in BACKLOG `Sprint 4+ queue`.
- 2026-04-22 — Sprint 4 Day 1 shipped + wrapped: 6 WPs, 5 commits, hosted Supabase live, Opus 4.7 → deployed `/api/mcp` E2E verified. Review flow updated so subagent outputs findings only — main session writes marker after user ack. Six memories harvested (Anthropic mcp_toolset gotcha, vitest .env.local loader, review flow, idempotent migrations, sprint-size guardrail, single-tenant trigger).
