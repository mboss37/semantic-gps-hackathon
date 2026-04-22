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
- **Sprint 5 — Day 2: scoped gateway + routes schema + auth pages (Thu 2026-04-23):**
  - C.3 `REAL_PROXY_ENABLED` flipped default-on; typed `ExecuteResult` discriminated union; `mcp_events.latency_ms` now prefers upstream wire time
  - C.5 `tools/list` emits `_meta.relationships: [{ to, type, description }]` per tool when outgoing edges exist; omitted otherwise
  - B.2 `routes` + `route_steps` tables with ordered steps, `fallback_route_id` (set null), `rollback_tool_id` (set null), `tool_id` (restrict) — unblocks F.1 `execute_route`
  - D.1 Three-tier scoped gateway: `/api/mcp` (org) + `/api/mcp/domain/[slug]` + `/api/mcp/server/[id]`; shared `buildGatewayHandler(scopeResolver)`; per-scope `Manifest` cache keyed on `ManifestScope` discriminated union
  - G.5 3 new pre-call policies (`basic_auth`, `client_id`, `ip_allowlist`) fail-closed; `PreCallContext` gained `headers` + `client_ip` threaded from the Request; IPv4 CIDR matcher inline; 25 unit tests
  - A.2 Supabase email/pw signup + login + logout pages (client form split into its own component for Suspense boundary around `useSearchParams`); `proxy.ts` + dashboard layout redirect to `/login` instead of dev-login; dev-login still available behind env gate for seeded demo
  - Validations: local `pnpm test` 95/97 ✓, httpbin smoke 2/2 ✓, local gateway curl all 3 scopes ✓, `supabase db push` applied routes + builtin_keys to hosted, deployed gateway curl all 3 scopes ✓, Opus 4.7 → deployed `/api/mcp` E2E 9.76s ✓, `pnpm exec next build` ✓

## Current:
_Sprint 5 closed. Pull Sprint 6 candidates from `BACKLOG.md > Sprint 4+ queue` — unblocked after Thu: D.2 (blocked-by-A.4 which is still queued), E.1 / E.2 / E.3 (all unblocked by C.3), F.1 (unblocked by B.2 + C.3), G.2 (unblocked by B.3 from Sprint 4 Day 1), G.4 (unblocked by B.4), plus dep-free options A.3 / A.5 / C.4 / F.4 / G.6 / G.8 / H.1 / H.2._

## Session Log
- 2026-04-22 — Sprint 4 collapsed to daily-sprint cadence (mega-sprint violated 3-6 sweet spot). Today = 6 day-1 unblockers; other 36 WPs parked in BACKLOG `Sprint 4+ queue`.
- 2026-04-22 — Sprint 4 Day 1 shipped + wrapped: 6 WPs, 5 commits, hosted Supabase live, Opus 4.7 → deployed `/api/mcp` E2E verified. Review flow updated so subagent outputs findings only — main session writes marker after user ack. Six memories harvested.
- 2026-04-23 — Sprint 5 Day 2 shipped + wrapped: 6 WPs, 4 commits, three-tier scoped gateway live on Vercel, `REAL_PROXY_ENABLED` default-on, routes/route_steps schema ready for F.1, Supabase auth pages replace dev-login. Reviewer caught Next 16 `useSearchParams` Suspense blocker pre-build — codified `next build` into pre-commit gate. 7 hardening items queued in BACKLOG.
