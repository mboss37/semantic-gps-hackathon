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

## Current: Sprint 5 — Gateway routing + routes schema + auth (Thu 2026-04-23, 6 WPs)

Day 1 shipped schema + real proxies. Day 2 goal: flip real-proxy default-on, open three-tier gateway routing (unblocks J.1 Playground), land `routes` + `route_steps` (unblocks F.1 `execute_route`), ship real auth pages (unblocks D.2 gateway auth Fri). Parallel UI work on 3 more built-in policies.

- [ ] **C.3** (S) Dispatcher: flip `REAL_PROXY_ENABLED=1` default-on; drop feature-flag branch from `tool-dispatcher.ts`; audit logs carry `upstream_latency_ms`.
- [ ] **D.1** (M) `/api/mcp/domain/[id]` + `/api/mcp/server/[id]` scoped gateway routes with scoped `loadManifest(scope)`.
- [ ] **B.2** (M) `routes` + `route_steps` tables (ordered, `fallback_route_id`, `rollback_tool_id`).
- [ ] **A.2** (M) Signup + login + logout pages (Supabase email/pw). Replace dev-login. Critical path for Fri's D.2 gateway-auth WP.
- [ ] **G.5** (M) Basic-auth + client-ID + IP allow/block built-in policies (3 of the 7 built-ins).
- [ ] **C.5** (S) `tools/list _meta.relationships` injection so agents see typed edges as MCP metadata.

### Cadence reminder
- **Sprint 6 Fri** candidates once Thu closes: D.2 (gateway auth), E.1 E.2 E.3 (Salesforce + Slack + GitHub), F.1 (`execute_route`), G.2 (relationship CRUD UI), G.4 (rate-limit + injection-guard policies + `policy_versions` writes).
- **Sprint 7 Sat** — last build day: F.2 F.3 (fallback + rollback execution), J.1 Playground A/B hero, I.1 I.2 (Opus showcase beats), J.3 (demo seed) + **record demo PM**.

### Risks to watch
- A.2 must land Thu — slip pushes D.2 to Sat AM and the Playground compresses into one afternoon.
- C.3 flipping default-on means every run hits real upstreams. Post-merge: `VERIFY_REAL_PROXY=1 pnpm test smoke-real-proxy` to confirm httpbin still round-trips.
- D.1 manifest-scope refactor is on the hot path — keep `/api/mcp` shape working so Tier 1 Anthropic E2E stays green.
- E.1 Salesforce Dev-Edition creds must be confirmed Thu PM before E.* ships Fri.

## Session Log
- 2026-04-22 — WP-3.5 shipped (shadcn dashboard-01 + MCP direct-import tool discovery). Reality-check vs `/projects/semantic-gps/docs` → 3.6 deferred, Sprint 4 opened. Architect + PO review of USER-STORIES.md produced 42-WP plan + locked decisions + Playground A/B hero.
- 2026-04-22 — Sprint 4 collapsed to daily-sprint cadence (mega-sprint violated 3-6 sweet spot). Today = 6 day-1 unblockers; other 36 WPs parked in BACKLOG `Sprint 4+ queue`.
- 2026-04-22 — Sprint 4 Day 1 shipped + wrapped: 6 WPs, 5 commits, hosted Supabase live, Opus 4.7 → deployed `/api/mcp` E2E verified. Review flow updated so subagent outputs findings only — main session writes marker after user ack. Six memories harvested (Anthropic mcp_toolset gotcha, vitest .env.local loader, review flow, idempotent migrations, sprint-size guardrail, single-tenant trigger).
