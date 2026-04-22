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

## Current: Sprint 4 — Day-1 unblockers (Wed 2026-04-22, 6 WPs)

Daily-sprint cadence through Sat (CLAUDE.md sweet spot = 3-6 WPs/sprint). Each morning: pull the next day's WPs from `BACKLOG.md` → `Sprint 4+ queue` using the dep graph to pick what's unblocked.

Today's goal: land schema + real proxy foundations so Thu can parallelize against real integrations (E.*) and route orchestration (F.*).

- [ ] **A.1** (M) `organizations` + `memberships` schema; migrate `servers.user_id` → `organization_id`; auto-create org + admin membership on first signup.
- [ ] **B.1** (S) `domains` table + `servers.domain_id` FK + seed "SalesOps" domain. ← A.1
- [ ] **B.3** (S) Relationship taxonomy migration — replace CHECK with stories' 8 types (`produces_input_for`, `requires_before`, `suggests_after`, `mutually_exclusive`, `alternative_to`, `validates`, `compensated_by`, `fallback_to`). Update TRel handlers + tests + docs.
- [ ] **B.4** (S) `policy_versions` table + snapshot trigger on policy mutations.
- [ ] **C.1** (M) Real OpenAPI HTTP proxy (`lib/mcp/proxy-openapi.ts`) — decrypt `auth_config`, inject auth header, compose path/query/body, SSRF-guard, 5xx retry.
- [ ] **C.2** (M) Real direct-MCP HTTP-Streamable proxy (`lib/mcp/proxy-http.ts`) — JSON-RPC forward `tools/call` to upstream with decrypted bearer.

### Cadence
- **Sprint 4** · Wed today · 6 WPs above
- **Sprint 5** · Thu · pull AM from queue — likely `A.2, B.2, C.3, D.1` + one UI WP
- **Sprint 6** · Fri · likely `D.2, E.1, E.2, E.3, F.1, G.2, G.4`
- **Sprint 7** · Sat **last build day** · `F.2, F.3, J.1 hero, I.1, I.2, J.3` + **record demo PM**
- **Sun** · submission only (README + summary + upload). No debugging.

Queue is aspirational — actual daily pulls pick whatever's unblocked that morning.

### Hero demo
**Playground A/B** — left pane Claude Opus 4.7 + raw SF/Slack/GitHub MCPs (ungoverned); right pane same Opus 4.7 + `/api/mcp/domain/salesops`. Same scenario, same backends, same agent. Mid-demo PII enforce toggle on right pane only — next run redacts customer email in the Slack post.

### Locked decisions
- **Taxonomy:** stories' 8 types. `fallback_to` drives fallback execution, `compensated_by` drives rollback execution.
- **Auth:** Supabase email/pw. First signup auto-creates org + admin. No invites/roles UI.
- **Salesforce:** `jsforce` username-password.
- **Policies:** ship built-ins only (PII, allowlist, rate-limit, injection-guard, Basic-auth, client-ID, IP allow/block).
- **Playground is the hero demo.**
- **Monitoring:** 3 lean widgets fixed.

### Risks to watch
- B.3 is the day-1 domino — blocks downstream G.2 + F.2 + F.3. Land it today.
- E.1 Salesforce needs a Dev-Edition with API access — confirm creds before pulling E.* (Fri).
- J.1 Playground is L-size + 5 cross-stream deps → highest slip risk; pull no later than Sat AM.
- Live integration tests burn real API quotas — gate behind `VERIFY_INTEGRATIONS=1`.

## Session Log
- 2026-04-21 — Sprint 3 opened; WP-3.1 through 3.4 shipped same day (core schema + gateway + TRel discovery + policy engine). Opt-in Anthropic SDK test proves Opus 4.7 drives the deployed gateway via MCP connector.
- 2026-04-22 — WP-3.5 shipped (shadcn dashboard-01 + MCP direct-import tool discovery). Reality-check vs `/projects/semantic-gps/docs` → 3.6 deferred, Sprint 4 opened. Architect + PO review of USER-STORIES.md produced 42-WP plan + locked decisions + Playground A/B hero.
- 2026-04-22 — Sprint 4 collapsed to daily-sprint cadence (mega-sprint violated 3-6 sweet spot). Today = 6 day-1 unblockers; other 36 WPs parked in BACKLOG `Sprint 4+ queue` for Thu/Fri/Sat daily pulls. Sat = record demo, Sun = submission only.
