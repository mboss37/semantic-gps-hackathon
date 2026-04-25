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

**Sprint 21 — Dashboard polish + Landing v1 + auto-refresh (Sat Apr 25):**
- WP-21.1 Sidebar grouped Overview/Configure/Operate via NavMain `label` prop. WP-21.2 SiteHeader brand cluster (org name + "Built with Opus 4.7" violet pill) + color-coded KPI badges (emerald/sky/indigo); sparklines deferred.
- WP-21.3 Gateway Traffic faded mock-chart empty state at opacity-25 + overlay caption. WP-21.4 Landing v1: real Playwright dashboard screenshot replaces 288-line DashboardMockup, StatStrip (12/7/3/14), DemoVideoSection at #demo with `NEXT_PUBLIC_DEMO_VIDEO_URL`.
- WP-21.5 Auto-refresh: `useDashboardRefresh()` hook (`router.refresh()` + `'semgps:dashboard-refresh'` window CustomEvent, 2s debounce), tab-focus listener in SiteHeader, manual `<RefreshButton />`, chart subscribes to event. Realtime → BACKLOG P1.
- Chrome polish bundled with 21.5: muted main (`--background: oklch(0.10 0 0)`) / pure-black chrome (`--sidebar: oklch(0 0 0)`), SidebarInset `border overflow-hidden` so rounded shape clips the `bg-sidebar` header strip.
- Hard-Won Lessons #37 (shadcn inset color collapse) + #38 (router.refresh vs client-state). 8 commits, 341/2/0 tests.

**Sprint 22 — Realtime + audit + settings + fallback completeness (Sat Apr 25 PM):**
- WP-22.1 Realtime push for `mcp_events` — publication ALTER + REPLICA IDENTITY FULL + `useRealtimeDashboardEvents` hook with `setAuth(session.access_token)` (canonical RLS-in-channel fix; cookie hydration alone doesn't carry JWT to the websocket). Verified local + hosted.
- WP-22.2 Audit detail Sheet — row-click opens Radix drawer with status/policy verdicts/redacted payload/trace_id copy. New `/api/audit/[id]` (org-scoped). Stale-flash dodged via `detail.id === eventId` derived state (no setState-in-effect).
- WP-22.4 Slack→GitHub `fallback_to` seeded; demo story #8 unlocked.
- WP-22.4 follow-on — `route_steps.fallback_input_mapping` (translate args into fallback target shape) + `fallback_rollback_input_mapping` (compensator-aware saga unwind). `ExecuteRouteFallbackUsed.fallback_tool_id` lets executeRollback pick the right `compensated_by` edge when fallback was used. E2E proven: zero orphans on rollback after fallback succeeds (compensated_count: 2, failed_count: 0).
- WP-22.5 Settings page (`/dashboard/settings` — first/last/company/org name) + Workspace identity badge in sidebar (Vercel/Linear pattern, gradient outline + initial avatar + animated emerald live-dot, click → settings).
- WP-22.3 NL Policy Author parked → BACKLOG P1 (Opus 4.7 lever; 2-3h scope; demo doesn't need it).

**Sprint 23 — Operate-cluster polish: charts + audit + range pickers (Sat Apr 25 evening):**
- WP-23.2 Charts unified on shadcn `<ChartContainer>` + single palette source (`lib/charts/palette.ts`) — STATUS_COLORS/LABELS/BADGE_CLASS + ChartConfig builders shared by audit table, audit Sheet, audit timeline, monitoring 3 charts, policy timeline. `rollback_executed` orange added.
- Audit DataTable refactor (was Sprint 23 cut, landed) — `audit-row.tsx` button-list → shadcn `<Table>` (Time/Method/Tool/Status/Latency/Trace). 6 filter pills (All/Allowed/Blocked/Errors/Fallbacks/Rollbacks). Status-count bar chart killed; replaced with Datadog-style timeline LineChart (5 status lines, server-bucketed via `lib/audit/timeline.ts`).
- Monitoring + Audit time-range picker (`15m/30m/1h/6h/24h/7d`) — shared spec in `lib/monitoring/range.ts`. Combined `/api/monitoring` endpoint (volume+blocks+pii in one SQL round-trip via `lib/monitoring/fetch-windowed.ts`). `/api/audit` accepts `range` param + returns pre-bucketed timeline.
- Auto-range on first load — server picks smallest range whose window contains latest event (`pickAutoRange + fetchLatestEventMs`). Lands users on non-empty chart. User picks sticky.
- Bug fixes mid-flight: recharts `barCategoryGap={16}` collapsed stacked bars to 0.04px (stripped, default 10% works); React 19 `react-hooks/purity` blocks `Date.now()` in render (server-side bucketing pattern). 5 memories + Hard-Won Lessons #42/#43/#44. WP-23.1 Connect page + WP-23.3 KPI hero strip parked back to BACKLOG. 344/2/0 tests.

## Current:

**Sprint 24 — Connect UX + Monitoring KPI hero (Sat Apr 25 night, ~5h budget):**
> Last build hours before tomorrow's recording day. Connect page is the priority — without it, anyone who signs up tomorrow has zero clue where to point their MCP client. That's the textbook "signup drops user into empty dashboard" anti-pattern from CLAUDE.md § Anti-patterns. Every judge who treats the product as a product (not just a video) hits a dead end at minute 2 — direct hit on the 30% Impact weight. KPI hero is stretch: lifts Monitoring from "alpha tooling" to "Datadog-tier first impression" if Connect lands by ~3h in.

- **WP-24.1 Gateway Connect page** (~3h) — new `/dashboard/connect` page. Three-tier endpoint cards: org-wide `/api/mcp` + domain-scoped `/api/mcp/domain/<slug>` (with selector) + server-scoped `/api/mcp/server/<id>` (with selector). Token row linking to `/dashboard/tokens` (or showing minted tokens with copy buttons; plaintext NEVER re-shown). Connection snippets per client: `curl tools/list`, Claude Desktop `claude_desktop_config.json` MCP server entry, MCP Inspector launch URL, Anthropic SDK `mcp_servers` block. Optional "Test connection" button firing `tools/list` inline. Sidebar link in Build group right after Tokens. Industry pattern (Kong / MuleSoft / Tyk / Apigee all ship this — "How do I use this?" page is table stakes for any API gateway).
- **WP-24.2 Monitoring KPI hero strip** (~2h, stretch) — 4-card row above charts mirroring overview's `SectionCards`: Total calls / Error rate % / Block rate % / p95 latency, each with delta vs prior period + sparkline. Right now Monitoring opens straight into the 3 stacked bars with zero KPI signal — judges have to mentally aggregate. Lifts Operate cluster to "Datadog-tier first impression". Only ship if 24.1 lands by ~3h in.

## Session Log
- 2026-04-25 — Sprint 23 shipped: 1 commit. Mid-sprint scope pivot: original plan was Connect page + charts + KPI strip; actual ship was charts unification + audit DataTable + audit timeline LineChart + range pickers (Monitoring + Audit) + auto-range pick. Datadog-grade polish: `lib/charts/palette.ts` single palette source, `lib/monitoring/range.ts` shared time-range vocabulary, `lib/audit/timeline.ts` server-side bucketing. Caught react-19 purity rule bouncing `Date.now()` in render → bucket on server. Caught barCategoryGap numeric collapse to 0.04px via Playwright SVG inspection. Connect page + KPI strip back to BACKLOG. 6 memories + Hard-Won Lessons #42/#43/#44. 344/2/0 tests.
- 2026-04-25 — Sprint 22 shipped: 5 WPs, ~8 commits pushed. Realtime push on dashboard (Postman call → live chart pulse, no manual refresh) — `setAuth(session.access_token)` is the canonical Supabase Realtime + `@supabase/ssr` handshake, cookie alone doesn't carry the JWT to the websocket. Audit detail Sheet for governance UX. Fallback path completed: `fallback_input_mapping` translates Slack args to GH issue shape; `fallback_rollback_input_mapping` translates fallback's GH result to close_issue input; `ExecuteRouteFallbackUsed.fallback_tool_id` lets the saga rollback pick the right compensator. E2E proven twice — zero orphans. Settings page + workspace badge pulled from BACKLOG mid-sprint. NL Policy Author parked to P1. Local + hosted in parity (24 → 26 migrations).
- 2026-04-25 — Sprint 21 shipped: 5 WPs, 8 commits pushed. Public-face polish — sidebar grouped 3 sections, header brand cluster, KPI badges color-coded, Gateway Traffic faded mock-chart empty state, landing hero swapped 288-line DashboardMockup for a real Playwright screenshot of the seeded dashboard. WP-21.5 auto-refresh: `useDashboardRefresh()` fires `router.refresh()` + `'semgps:dashboard-refresh'` CustomEvent on tab focus or manual button click, 2s debounce. Chrome polish bundled: muted main / pure-black chrome inverts shadcn defaults to favor chrome-as-frame. Caught + fixed shadcn inset color-collapse interactively with the user. Realtime deferred to BACKLOG P1. 5 memories + Hard-Won Lessons #37/#38. 341/2/0 tests.
