# claude-hackathon — Task Tracker

> Claude: Read at session start. Keep focused — only current state + shipped history matters.
> Completed sprints: **max 6 lines each** (1 header + up to 5 body). One line per WP, condensed. Merge small items. No validation/BACKLOG/retrospective lines. Session log: 3 lines max, last 3 sessions.

## Completed Sprints

**Sprint 1 — Setup:** Next.js 16 + React 19 + Tailwind 4 + TypeScript-strict + ESLint 9 scaffold, shadcn init, `supabase init`, `.env.example`, vitest smoke; all quality gates green.

**Sprint 2 — Infra foundation:**
- Hosted Supabase `cgvxeurmulnlbevinmzj` (Central EU); local stack on :54321
- Migration pipeline proven local→hosted; Vercel live via Supabase Marketplace integration
- CLAUDE.md process rules locked: local-first Supabase, pull-from-backlog removes-from-backlog

**Sprint 3 — Core spine + gateway skeleton + dashboard:**
- 3.1 Spine libs + 6-table schema (auth, proxy, SSRF, encrypt, manifest cache)
- 3.2 MCP gateway Inspector-verified on Vercel; echo tool E2E via Anthropic SDK
- 3.3 OpenAPI import + servers CRUD + TRel `discover_relationships` / `find_workflow_path`
- 3.4 Policy engine with shadow/enforce toggle (PII + allowlist built-ins)
- 3.5 Dashboard + MCP direct-import tool discovery. 3.6 Demo agent deferred.

**Sprint 4 — Multi-tenant schema + real proxies (Wed Apr 22):**
- A.1/B.1 `organizations` + `memberships` + `domains` schema; signup trigger auto-seeds org + membership + SalesOps domain
- B.3 Relationship taxonomy: 8 canonical types. B.4 `policy_versions` audit table with trigger.
- C.1 Real OpenAPI HTTP proxy — decrypt auth, SSRF-guarded fetch, 5xx retry
- C.2 Real direct-MCP HTTP-Streamable proxy — JSON-RPC + single-event SSE, Zod boundary
- Tier-1 Opus 4.7 → deployed `/api/mcp` → echo E2E in 4.87s

**Sprint 5 — Scoped gateway + routes + auth pages (Thu Apr 23):**
- C.3 Real-proxy default-on; typed `ExecuteResult` discriminated union
- C.5 `tools/list` emits `_meta.relationships`. B.2 `routes` + `route_steps` tables.
- D.1 Three-tier scoped gateway — org + domain + server; shared `buildGatewayHandler(scopeResolver)`
- G.5 Pre-call policies `basic_auth` + `client_id` + `ip_allowlist` (fail-closed)
- A.2 Supabase email/pw signup + login + logout pages; dev-login removed

**Sprint 6 — Orchestration + gateway auth + authoring UI:**
- D.2 Gateway bearer-token auth via `gateway_tokens` (org-scoped, SHA-256 hashed)
- F.1 `execute_route` — ordered step execution with `input_mapping` DSL, per-step policies, capture bag
- G.6 Semantic rewriting (`display_name` + `display_description`). G.4 Rate-limit + injection-guard runners.
- G.2 Relationship CRUD API + dashboard UI. Service-client hardening for Vercel env-var dropout.

**Sprint 7 — Real Salesforce + token UI + fallback:**
- A.6 Gateway token mint + rotate UI; plaintext shown once, SHA-256 hashed in DB
- F.2 Fallback execution — `execute_route` walks `fallback_to` on origin_error
- E.1 Salesforce OAuth 2.0 Client Credentials + 5 tools; raw fetch, no jsforce
- J.3 `sales_escalation` route seeded — 3 steps with input mapping
- CI fix — DB-integration suites skip on Actions; route suites stub service client

**Sprint 8 — Cross-MCP orchestration + Playground A/B (Thu Apr 23):**
- E.2 Slack proxy (3 tools). E.3 GitHub proxy (4 tools, response projection).
- F.3 Rollback execution — `compensated_by` in REVERSE on halt; shared `UpstreamError`
- J.3-ext Cross-MCP seed + `cross_domain_escalation` route. J.1 Playground A/B two-pane workbench.
- I.2 Rollback cascade viz. G.1 `validate_workflow` + `evaluate_goal` real implementations.
- Demo E2E live locally via Cloudflare tunnel + on Vercel against real SF/Slack/GH.

**Sprint 9 — Gateway-native policy set + demo presets (Fri Apr 24):**
- G.10 `business_hours` (timezone-aware, DST-safe). G.11 `write_freeze` kill-switch.
- G.9 Tool-level policy assignment UI. J.4 Playground preset overhaul (3 scenarios).
- J.5 Idempotent policy seed script. Refactor: `policy-config-forms.tsx` split 549→142 lines.
- G.12 `budget_cap` retired — gateway governs the CALL, downstream governs the DATA.

**Sprint 10 — Policy taxonomy completion + demo-readiness (Thu Apr 23 PM):**
- G.13 `geo_fence` + G.14 `agent_identity_required` + G.15 `idempotency_required` — completes 12 builtins. G.16 Env-driven model IDs.
- Refactor: `built-in.ts` split 562→57 lines. libphonenumber-js replaces PII regex.
- `scripts/bootstrap-local-demo.sql` idempotent seed. Canonical saga pattern (`rollback_input_mapping` + `CapturedStep`).
- `docs/DEMO.md` recording playbook. 4 demo stories E2E validated against real SF/Slack/GH.

**Sprint 11 — Submission gates + vision signaling (Thu Apr 23 PM):**
- 11.1 CNA landing replaced with Semantic GPS page. 11.2 `README.md` full rewrite.
- 11.3 `docs/SUBMISSION.md` (150-word summary + elevator pitch). 11.4 `VISION.md` (~600 words).
- 11.5 `scripts/cleanup-demo-data.mjs` with `--dry-run`. 11.6 Policy row ToggleGroup for 1-click shadow↔enforce.

**Sprint 12 — Opus amplifier + saga honesty (Thu Apr 23 PM):**
- 12.1 Extended-thinking blocks in Playground — both panes, collapsible reasoning panel
- 12.2 Compensation edges for Slack + SF — `delete_message` + `delete_task` tools, `rollback_input_mapping`
- 12.3 Manifest cache invalidation endpoint. Hard-Won Lesson #21 (`_`-prefixed folders are private).
- 12.4 Policy shadow→enforce timeline — `/api/policies/[id]/timeline` + Recharts stacked bars

**Sprint 13 — Route visibility + self-serve + polish (Thu Apr 23 PM):**
- 13.1 Route designer UI — `/dashboard/routes` list + detail with React Flow canvas + step side panel
- 13.2 Per-server detail — `/dashboard/servers/[id]` with tools, violation counts, config snippet, live introspection
- 13.3 Monitoring page — `/dashboard/monitoring` with 3 Recharts widgets (volume, policy blocks, PII)
- 13.4 `business_hours` multi-window + overnight wrap with backcompat `z.union` transform

**Sprint 14 — Dashboard polish (Thu Apr 23 evening):**
- 14.1 Overview chart live data — `/api/gateway-traffic` reusing `fetchCallVolume`; 2024 fixture retired
- 14.2 Origin health probes — `/api/servers/[id]/health` with `ServerHealthBadge` replacing F.4 placeholder
- 14.3 Rediscover tools — `/api/servers/[id]/rediscover`, `decodeAuthConfig` extracted to `lib/servers/auth.ts`

**Sprint 15 — Enterprise shape (Fri Apr 24):**
- C.6 Extract vendor proxies to in-process `app/api/mcps/<vendor>/` routes; dispatcher narrowed
- K.1 Enterprise data-model audit — `mcp_events.organization_id`, billing metadata, `memberships.role` widened
- A.7 Onboarding wizard — `/onboarding` page + server action; `proxy.ts` + dashboard layout gate
- Multi-tenancy sweep: `organization_id NOT NULL` on policies/assignments; every page org-scoped

**Sprint 16 — Enterprise hardening / Postgres RLS (Fri Apr 24 PM):**
- L.1 RLS on 13 tenant tables — `custom_access_token_hook` + `jwt_org_id()` + `org_isolation` policies
- L.1 follow-up: `member_update_self` tenant-escape fixed (WITH CHECK pins `organization_id`)
- L.1 auth callback (PKCE exchange). L.1 tests: 9 RLS assertions + hosted 3-org IDOR sweep.
- M.1 Migration workflow hardening. Hard-Won Lessons #26–#29.

**Sprint 17 — Pre-launch hygiene (Fri Apr 24 PM):**
- 17.1 Policy catalog gallery — `/dashboard/policies/catalog`, 12 builtins, 7 governance dimensions
- 17.2 Playground token consent fix — `gateway_tokens.kind` column, system token read-or-create
- 17.3 Playground no-MCP guard. 17.4 Empty-state dashboard audit (7 pages verified).
- Worktree isolation mandated post-sprint after parallel subagent clobber. Lessons #30 + #31.

**Sprint 18 — Public face (Fri Apr 24 evening):**
- 18.1 Specialist prework — PO + Content + Designer subagents; pinned "enterprise, not DTC" direction
- 18.2 Landing page v0 — Vercel palette + Geist everywhere, Portkey-style hero with dashboard-mockup. v1 in BACKLOG.
- 18.3 E2E signup validated on deploy — bonus: `/signup/check-email` page, auth-callback error surfacing, hosted migration 22 pushed
- Hard-Won Lesson #32: migration drift gate codified in `.claude/rules/migrations.md § Sprint wrap`.

**Sprint 19 — Reviewer findings sweep + rollback cascade fix:**
- 15 findings cleared: shadcn style sweep + dual-sidebar demote + DEMO.md arg, onboarding let-ctx + `created_by` guard, security defense-in-depth (`kind` filter + URL pathname + console.error sanitize), auth-config dedup to `lib/servers/auth.ts`, assignments + `mintPlaygroundToken` extractions, `bootstrap.sql` templating + fail-loud
- WP-19.6 file splits: `executeRollback` → `lib/mcp/execute-rollback.ts`; `playground-workbench.tsx` 485→183 via `playground-{scenarios,event-reducer,pane-view}`. New `route-utils.ts` leaf breaks execute-route↔rollback cycle
- WP-19.7 rediscover: batch upsert + `(server_id,name)` UNIQUE migration + dry-run preview Dialog
- WP-19.8 auth hook: `profile_completed` folded into JWT claim, `active_org_id` metadata + `PUT /api/user/active-org`, `decodeJwtClaims` reused by `proxy.ts`
- WP-19.9 rollback cascade: `unwrapMcpEnvelope` at capture bag (handles bare-array + wrapped shapes). Lessons #33 + #34. Verified unit + proven-negative integration + local E2E (compensated_count:2, failed_count:0)

**Sprint 20 — Dashboard nav perf + onboarding JWT refresh (Sat Apr 25):**
- WP-20.1 Onboarding JWT refresh — `auth.refreshSession()` after profile flip so cookie carries fresh `profile_completed:true`. Hosted migrations 220000/220100 backfilled mid-sprint after fresh-signup hit hook drift.
- WP-20.2 `requireAuth` React `cache()` wrap — 3 duplicate `getUser()` round-trips → 1 per RSC render. Contract tests since `cache()` is no-op in vitest.
- WP-20.3 `loading.tsx` skeletons — top-level + servers/routes/monitoring. Perceived nav latency: blank-on-previous → <50ms paint.
- WP-20.4 Catalog `force-dynamic` removed — annotation cleanup, PPR-ready (layout cookies still envelope-dynamic).
- 20.5 per-card Suspense skipped (stretch). Lessons #35 + #36. 341/2/0 tests, 6 commits.

## Current:

**Sprint 21 — Dashboard polish + Landing v1:**
- [x] WP-21.1 Sidebar grouping — Overview / Configure / Operate. NavMain accepts optional label.
- [x] WP-21.2 Header brand cluster (org name + "Built with Opus 4.7" violet pill) + color-coded KPI badges (emerald/sky/indigo). Sparklines deferred — flat-line on empty DB low signal.
- [x] WP-21.3 Gateway Traffic empty state: faded mock-chart at opacity-25 with overlay caption. Breadcrumbs cut — existing back-links functional.
- [x] WP-21.4 Landing v1: real dashboard screenshot replaces 288-line DashboardMockup, new StatStrip (12/7/3/14), new DemoVideoSection at #demo with `NEXT_PUBLIC_DEMO_VIDEO_URL` env. `/` stays static.

## Session Log
- 2026-04-25 — Sprint 20 shipped: 4 WPs, 6 commits pushed. Dashboard nav perf collapse — `requireAuth` React `cache()` wrap (3 `getUser()` round-trips → 1 per RSC render) + `loading.tsx` skeletons → perceived nav latency ~1-2s blank → <50ms instant paint. Onboarding JWT-refresh fix unblocks every fresh signup: `auth.updateUser` doesn't refresh tokens, so `refreshSession()` after the flag flip is mandatory for the hook to re-stamp claims. Hosted migrations 220000/220100 backfilled mid-sprint after fresh-signup hit hooked-claim drift (Lesson #32 gate held but human skipped it; memo to self next time). 5 memories + Hard-Won Lessons #35/#36. 341/2/0 tests.
- 2026-04-24 — Sprint 19 shipped: 9 WPs, 21 items, 2 commits pushed. MCP envelope unwrap at capture bag unblocks demo story #9 (verified three ways: 7 unit + proven-negative integration + live E2E against real SF/Slack/GH). Reviewer flagged 7 blockers — fixed 5 (circular via route-utils leaf, getSession waivers, `as` cast cleanup), accepted 2 (execute-route.ts 610 lines, executeRollback 155 lines) as pragma. 7 memories + Hard-Won Lessons #33/#34. 337/2/0 tests.
- 2026-04-24 — Sprint 18 shipped: 3 WPs (specialist prework + landing v0 + end-to-end deploy signup validation). Bonuses mid-WP-3: `/signup/check-email` industry page, `/login` `?error=` surfacing, hosted migration 22 push closing a week-old Sprint 17 drift. New Hard-Won Lesson #32 + `migrations.md § Sprint wrap` gate pin the drift class. Four memories stored. 327/2/0. 6 commits.
