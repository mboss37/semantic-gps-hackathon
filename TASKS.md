# claude-hackathon: Task Tracker

> Claude: Read at session start. Keep focused: only current state + shipped history matters.
> Completed sprints: **max 6 lines each** (1 header + up to 5 body). One line per WP, condensed. Merge small items. No validation/BACKLOG/retrospective lines. Session log: 3 lines max, last 3 sessions.

## Completed Sprints

**Sprint 1: Setup:** Next.js 16 + React 19 + Tailwind 4 + TypeScript-strict + ESLint 9 scaffold, shadcn init, `supabase init`, `.env.example`, vitest smoke; all quality gates green.

**Sprint 2: Infra foundation:**
- Hosted Supabase `cgvxeurmulnlbevinmzj` (Central EU); local stack on :54321
- Migration pipeline proven local→hosted; Vercel live via Supabase Marketplace integration
- CLAUDE.md process rules locked: local-first Supabase, pull-from-backlog removes-from-backlog

**Sprint 3: Core spine + gateway skeleton + dashboard:**
- 3.1 Spine libs + 6-table schema (auth, proxy, SSRF, encrypt, manifest cache)
- 3.2 MCP gateway Inspector-verified on Vercel; echo tool E2E via Anthropic SDK
- 3.3 OpenAPI import + servers CRUD + TRel `discover_relationships` / `find_workflow_path`
- 3.4 Policy engine with shadow/enforce toggle (PII + allowlist built-ins)
- 3.5 Dashboard + MCP direct-import tool discovery. 3.6 Demo agent deferred.

**Sprint 4: Multi-tenant schema + real proxies (Wed Apr 22):**
- A.1/B.1 `organizations` + `memberships` + `domains` schema; signup trigger auto-seeds org + membership + SalesOps domain
- B.3 Relationship taxonomy: 8 canonical types. B.4 `policy_versions` audit table with trigger.
- C.1 Real OpenAPI HTTP proxy: decrypt auth, SSRF-guarded fetch, 5xx retry
- C.2 Real direct-MCP HTTP-Streamable proxy: JSON-RPC + single-event SSE, Zod boundary
- Tier-1 Opus 4.7 → deployed `/api/mcp` → echo E2E in 4.87s

**Sprint 5: Scoped gateway + routes + auth pages (Thu Apr 23):**
- C.3 Real-proxy default-on; typed `ExecuteResult` discriminated union
- C.5 `tools/list` emits `_meta.relationships`. B.2 `routes` + `route_steps` tables.
- D.1 Three-tier scoped gateway: org + domain + server; shared `buildGatewayHandler(scopeResolver)`
- G.5 Pre-call policies `basic_auth` + `client_id` + `ip_allowlist` (fail-closed)
- A.2 Supabase email/pw signup + login + logout pages; dev-login removed

**Sprint 6: Orchestration + gateway auth + authoring UI:**
- D.2 Gateway bearer-token auth via `gateway_tokens` (org-scoped, SHA-256 hashed)
- F.1 `execute_route`: ordered step execution with `input_mapping` DSL, per-step policies, capture bag
- G.6 Semantic rewriting (`display_name` + `display_description`). G.4 Rate-limit + injection-guard runners.
- G.2 Relationship CRUD API + dashboard UI. Service-client hardening for Vercel env-var dropout.

**Sprint 7: Real Salesforce + token UI + fallback:**
- A.6 Gateway token mint + rotate UI; plaintext shown once, SHA-256 hashed in DB
- F.2 Fallback execution: `execute_route` walks `fallback_to` on origin_error
- E.1 Salesforce OAuth 2.0 Client Credentials + 5 tools; raw fetch, no jsforce
- J.3 `sales_escalation` route seeded: 3 steps with input mapping
- CI fix: DB-integration suites skip on Actions; route suites stub service client

**Sprint 8: Cross-MCP orchestration + Playground A/B (Thu Apr 23):**
- E.2 Slack proxy (3 tools). E.3 GitHub proxy (4 tools, response projection).
- F.3 Rollback execution: `compensated_by` in REVERSE on halt; shared `UpstreamError`
- J.3-ext Cross-MCP seed + `cross_domain_escalation` route. J.1 Playground A/B two-pane workbench.
- I.2 Rollback cascade viz. G.1 `validate_workflow` + `evaluate_goal` real implementations.
- Demo E2E live locally via Cloudflare tunnel + on Vercel against real SF/Slack/GH.

**Sprint 9: Gateway-native policy set + demo presets (Fri Apr 24):**
- G.10 `business_hours` (timezone-aware, DST-safe). G.11 `write_freeze` kill-switch.
- G.9 Tool-level policy assignment UI. J.4 Playground preset overhaul (3 scenarios).
- J.5 Idempotent policy seed script. Refactor: `policy-config-forms.tsx` split 549→142 lines.
- G.12 `budget_cap` retired: gateway governs the CALL, downstream governs the DATA.

**Sprint 10: Policy taxonomy completion + demo-readiness (Thu Apr 23 PM):**
- G.13 `geo_fence` + G.14 `agent_identity_required` + G.15 `idempotency_required`: completes 12 builtins. G.16 Env-driven model IDs.
- Refactor: `built-in.ts` split 562→57 lines. libphonenumber-js replaces PII regex.
- `scripts/bootstrap-local-demo.sql` idempotent seed. Canonical saga pattern (`rollback_input_mapping` + `CapturedStep`).
- `docs/DEMO.md` recording playbook. 4 demo stories E2E validated against real SF/Slack/GH.

**Sprint 11: Submission gates + vision signaling (Thu Apr 23 PM):**
- 11.1 CNA landing replaced with Semantic GPS page. 11.2 `README.md` full rewrite.
- 11.3 `docs/SUBMISSION.md` (150-word summary + elevator pitch). 11.4 `VISION.md` (~600 words).
- 11.5 `scripts/cleanup-demo-data.mjs` with `--dry-run`. 11.6 Policy row ToggleGroup for 1-click shadow↔enforce.

**Sprint 12: Opus amplifier + saga honesty (Thu Apr 23 PM):**
- 12.1 Extended-thinking blocks in Playground: both panes, collapsible reasoning panel
- 12.2 Compensation edges for Slack + SF: `delete_message` + `delete_task` tools, `rollback_input_mapping`
- 12.3 Manifest cache invalidation endpoint. Hard-Won Lesson #21 (`_`-prefixed folders are private).
- 12.4 Policy shadow→enforce timeline: `/api/policies/[id]/timeline` + Recharts stacked bars

**Sprint 13: Route visibility + self-serve + polish (Thu Apr 23 PM):**
- 13.1 Route designer UI: `/dashboard/routes` list + detail with React Flow canvas + step side panel
- 13.2 Per-server detail: `/dashboard/servers/[id]` with tools, violation counts, config snippet, live introspection
- 13.3 Monitoring page: `/dashboard/monitoring` with 3 Recharts widgets (volume, policy blocks, PII)
- 13.4 `business_hours` multi-window + overnight wrap with backcompat `z.union` transform

**Sprint 14: Dashboard polish (Thu Apr 23 evening):**
- 14.1 Overview chart live data: `/api/gateway-traffic` reusing `fetchCallVolume`; 2024 fixture retired
- 14.2 Origin health probes: `/api/servers/[id]/health` with `ServerHealthBadge` replacing F.4 placeholder
- 14.3 Rediscover tools: `/api/servers/[id]/rediscover`, `decodeAuthConfig` extracted to `lib/servers/auth.ts`

**Sprint 15: Enterprise shape (Fri Apr 24):**
- C.6 Extract vendor proxies to in-process `app/api/mcps/<vendor>/` routes; dispatcher narrowed
- K.1 Enterprise data-model audit: `mcp_events.organization_id`, billing metadata, `memberships.role` widened
- A.7 Onboarding wizard: `/onboarding` page + server action; `proxy.ts` + dashboard layout gate
- Multi-tenancy sweep: `organization_id NOT NULL` on policies/assignments; every page org-scoped

**Sprint 16: Enterprise hardening / Postgres RLS (Fri Apr 24 PM):**
- L.1 RLS on 13 tenant tables: `custom_access_token_hook` + `jwt_org_id()` + `org_isolation` policies
- L.1 follow-up: `member_update_self` tenant-escape fixed (WITH CHECK pins `organization_id`)
- L.1 auth callback (PKCE exchange). L.1 tests: 9 RLS assertions + hosted 3-org IDOR sweep.
- M.1 Migration workflow hardening. Hard-Won Lessons #26–#29.

**Sprint 17: Pre-launch hygiene (Fri Apr 24 PM):**
- 17.1 Policy catalog gallery: `/dashboard/policies/catalog`, 12 builtins, 7 governance dimensions
- 17.2 Playground token consent fix: `gateway_tokens.kind` column, system token read-or-create
- 17.3 Playground no-MCP guard. 17.4 Empty-state dashboard audit (7 pages verified).
- Worktree isolation mandated post-sprint after parallel subagent clobber. Lessons #30 + #31.

**Sprint 18: Public face (Fri Apr 24 evening):**
- 18.1 Specialist prework: PO + Content + Designer subagents; pinned "enterprise, not DTC" direction
- 18.2 Landing page v0: Vercel palette + Geist everywhere, Portkey-style hero with dashboard-mockup. v1 in BACKLOG.
- 18.3 E2E signup validated on deploy: bonus: `/signup/check-email` page, auth-callback error surfacing, hosted migration 22 pushed
- Hard-Won Lesson #32: migration drift gate codified in `.claude/rules/migrations.md § Sprint wrap`.

**Sprint 19: Reviewer findings sweep + rollback cascade fix:**
- 15 findings cleared: shadcn style sweep + dual-sidebar demote + DEMO.md arg, onboarding let-ctx + `created_by` guard, security defense-in-depth (`kind` filter + URL pathname + console.error sanitize), auth-config dedup to `lib/servers/auth.ts`, assignments + `mintPlaygroundToken` extractions, `bootstrap.sql` templating + fail-loud
- WP-19.6 file splits: `executeRollback` → `lib/mcp/execute-rollback.ts`; `playground-workbench.tsx` 485→183 via `playground-{scenarios,event-reducer,pane-view}`. New `route-utils.ts` leaf breaks execute-route↔rollback cycle
- WP-19.7 rediscover: batch upsert + `(server_id,name)` UNIQUE migration + dry-run preview Dialog
- WP-19.8 auth hook: `profile_completed` folded into JWT claim, `active_org_id` metadata + `PUT /api/user/active-org`, `decodeJwtClaims` reused by `proxy.ts`
- WP-19.9 rollback cascade: `unwrapMcpEnvelope` at capture bag (handles bare-array + wrapped shapes). Lessons #33 + #34. Verified unit + proven-negative integration + local E2E (compensated_count:2, failed_count:0)

**Sprint 20: Dashboard nav perf + onboarding JWT refresh (Sat Apr 25):**
- WP-20.1 Onboarding JWT refresh: `auth.refreshSession()` after profile flip so cookie carries fresh `profile_completed:true`. Hosted migrations 220000/220100 backfilled mid-sprint after fresh-signup hit hook drift.
- WP-20.2 `requireAuth` React `cache()` wrap: 3 duplicate `getUser()` round-trips → 1 per RSC render. Contract tests since `cache()` is no-op in vitest.
- WP-20.3 `loading.tsx` skeletons: top-level + servers/routes/monitoring. Perceived nav latency: blank-on-previous → <50ms paint.
- WP-20.4 Catalog `force-dynamic` removed: annotation cleanup, PPR-ready (layout cookies still envelope-dynamic).
- 20.5 per-card Suspense skipped (stretch). Lessons #35 + #36. 341/2/0 tests, 6 commits.

**Sprint 21: Dashboard polish + Landing v1 + auto-refresh (Sat Apr 25):**
- WP-21.1 Sidebar grouped Overview/Configure/Operate via NavMain `label` prop. WP-21.2 SiteHeader brand cluster (org name + "Built with Opus 4.7" violet pill) + color-coded KPI badges (emerald/sky/indigo); sparklines deferred.
- WP-21.3 Gateway Traffic faded mock-chart empty state at opacity-25 + overlay caption. WP-21.4 Landing v1: real Playwright dashboard screenshot replaces 288-line DashboardMockup, StatStrip (12/7/3/14), DemoVideoSection at #demo with `NEXT_PUBLIC_DEMO_VIDEO_URL`.
- WP-21.5 Auto-refresh: `useDashboardRefresh()` hook (`router.refresh()` + `'semgps:dashboard-refresh'` window CustomEvent, 2s debounce), tab-focus listener in SiteHeader, manual `<RefreshButton />`, chart subscribes to event. Realtime → BACKLOG P1.
- Chrome polish bundled with 21.5: muted main (`--background: oklch(0.10 0 0)`) / pure-black chrome (`--sidebar: oklch(0 0 0)`), SidebarInset `border overflow-hidden` so rounded shape clips the `bg-sidebar` header strip.
- Hard-Won Lessons #37 (shadcn inset color collapse) + #38 (router.refresh vs client-state). 8 commits, 341/2/0 tests.

**Sprint 22: Realtime + audit + settings + fallback completeness (Sat Apr 25 PM):**
- WP-22.1 Realtime push for `mcp_events`: publication ALTER + REPLICA IDENTITY FULL + `useRealtimeDashboardEvents` hook with `setAuth(session.access_token)` (canonical RLS-in-channel fix; cookie hydration alone doesn't carry JWT to the websocket). Verified local + hosted.
- WP-22.2 Audit detail Sheet: row-click opens Radix drawer with status/policy verdicts/redacted payload/trace_id copy. New `/api/audit/[id]` (org-scoped). Stale-flash dodged via `detail.id === eventId` derived state (no setState-in-effect).
- WP-22.4 Slack→GitHub `fallback_to` seeded; demo story #8 unlocked.
- WP-22.4 follow-on: `route_steps.fallback_input_mapping` (translate args into fallback target shape) + `fallback_rollback_input_mapping` (compensator-aware saga unwind). `ExecuteRouteFallbackUsed.fallback_tool_id` lets executeRollback pick the right `compensated_by` edge when fallback was used. E2E proven: zero orphans on rollback after fallback succeeds (compensated_count: 2, failed_count: 0).
- WP-22.5 Settings page (`/dashboard/settings`: first/last/company/org name) + Workspace identity badge in sidebar (Vercel/Linear pattern, gradient outline + initial avatar + animated emerald live-dot, click → settings).
- WP-22.3 NL Policy Author parked → BACKLOG P1 (Opus 4.7 lever; 2-3h scope; demo doesn't need it).

**Sprint 23: Operate-cluster polish: charts + audit + range pickers (Sat Apr 25 evening):**
- WP-23.2 Charts unified on shadcn `<ChartContainer>` + single palette source (`lib/charts/palette.ts`): STATUS_COLORS/LABELS/BADGE_CLASS + ChartConfig builders shared by audit table, audit Sheet, audit timeline, monitoring 3 charts, policy timeline. `rollback_executed` orange added.
- Audit DataTable refactor (was Sprint 23 cut, landed): `audit-row.tsx` button-list → shadcn `<Table>` (Time/Method/Tool/Status/Latency/Trace). 6 filter pills (All/Allowed/Blocked/Errors/Fallbacks/Rollbacks). Status-count bar chart killed; replaced with Datadog-style timeline LineChart (5 status lines, server-bucketed via `lib/audit/timeline.ts`).
- Monitoring + Audit time-range picker (`15m/30m/1h/6h/24h/7d`): shared spec in `lib/monitoring/range.ts`. Combined `/api/monitoring` endpoint (volume+blocks+pii in one SQL round-trip via `lib/monitoring/fetch-windowed.ts`). `/api/audit` accepts `range` param + returns pre-bucketed timeline.
- Auto-range on first load: server picks smallest range whose window contains latest event (`pickAutoRange + fetchLatestEventMs`). Lands users on non-empty chart. User picks sticky.
- Bug fixes mid-flight: recharts `barCategoryGap={16}` collapsed stacked bars to 0.04px (stripped, default 10% works); React 19 `react-hooks/purity` blocks `Date.now()` in render (server-side bucketing pattern). 5 memories + Hard-Won Lessons #42/#43/#44. WP-23.1 Connect page + WP-23.3 KPI hero strip parked back to BACKLOG. 344/2/0 tests.

**Sprint 24: Connect UX + Monitoring KPI hero + platform demo cleanup (Sat Apr 25 night):**
- WP-24.1 Gateway Connect page: `/dashboard/connect` with 3-tier scope tabs (Org / Domain "Soon" / Server), endpoint card, 4 client snippets (curl / Claude Desktop / MCP Inspector / Anthropic SDK), live token Test connection. Sidebar Build entry. New `connect-panel.tsx` (365 lines after redesign) + `lib/connect/snippets.ts` + extracted `<CopyButton>`.
- Mid-sprint UX cleanup driven by review: SiteHeader duplicate `<h1>` killed across all 11 dashboard pages (page content owns title); Connect Domain tab disabled with "Soon" pill (no domain CRUD yet).
- Migration `20260425260000_drop_default_salesops_domain.sql`: removed hardcoded SalesOps domain seed from `handle_new_user` trigger. New signups get clean orgs. SalesOps moved to `seed.sql` (local-only). `__tests__/domains.vitest.ts` rewritten for new contract.
- Connect origin fix (`6ccfa89`): `useSyncExternalStore(window.location.origin)` replaces stale `NEXT_PUBLIC_APP_URL` env. Endpoint URL always reflects the actual host (localhost / Vercel / tunnel).
- WP-24.2 Monitoring KPI hero strip: 4-card hero (Total calls / Error rate / Block rate / p95 latency) above charts. Each card current + delta vs equal-length prior window. `fetch-windowed.ts` widened SELECT to span both windows; in-memory p95 sort. 3 commits, 344/2/0 tests.

**Sprint 25: Servers UX overhaul + Overview cleanup (Sat Apr 25 late night):**
- WP-25.1 server-config-snippet origin fix: `useSyncExternalStore(window.location.origin)` replaces stale `NEXT_PUBLIC_APP_URL`; same pattern as Connect (`6ccfa89`). Cloudflared URL leak gone from per-server MCP client config block.
- WP-25.2 Server card overhaul: health dot top-left + 24h traffic stat strip (`6 tools · 12 calls 24h · 0 errors · registered Apr 25`) + overflow `⋯` menu (Delete + Rediscover) + capped tool pills (5 + "+N more") + whole-card clickable. Page batches single `mcp_events` GROUP BY for per-server counts; health derived from status mix (Hard-Won Lesson #47).
- WP-25.3 backend (`fetchMonitoringWindowed` serverId filter) + frontend (server detail reflow): header stat row, Origin status lifted to TOP, scoped `<MonitoringKpiStrip>` filtered by `serverId` (24h window), Resources/Prompts collapsed into one card or hidden when both empty.
- WP-25.4 Overview cleanup: bottom DataTable dropped (audit duplicate killed); replaced with "Recent activity → View full audit" CTA. Gateway Traffic chart default range `90d → 7d` so demo data shows real curve. SiteHeader title removed across all 11 dashboard pages (Hard-Won Lesson #46).
- 1 commit (`90033ee`). Reviewer Approved with 4 hackathon-skip suggestions. 344/2/0 tests, lint + typecheck clean.

**Sprint 26: Bulk dashboard UI refactor (Sat-Sun Apr 25-26 night, originally tagged 26-28 in commits):**
- Servers + Overview (`25a430b`): UX overhaul: live health, registration view, unified line charts.
- Relationships (`365fe64`): server-grouped editor with iconified type vocabulary.
- Routes (`b1da1e1`): server-card-aligned catalog + vertical timeline + saga-aware breadcrumb.
- Connect (`3d9ce6a`+`80a83dc`): one-Card flow with numbered sections + shared CodeBlock primitive; drop type=password on test-token input so password managers ignore it.
- Policies (`dfb66cd`+`a033d45`+`2b8c9ba`): unify catalog as sole surface, edit-in-place via per-instance modal, read-only mode pill, conditional Apply, blurred modal backdrop, Config row alignment.
- Chrome + Tokens (`07d46de`+`5e57642`+`ebee7ad`): hackathon tag, amber workspace badge, drop org-name from header, tokens header lede + Create button pinned top-right.

**Sprint 27: Audit page realtime + per-Run trace_id (Sun Apr 26 early AM):**
- Per-Run trace_id model: Playground threads `?trace_id=<uuid>` through every internal MCP call; gateway honors caller-supplied UUID, falls back to `randomUUID()`. One Run = one trace surfaced by existing audit filter; previous `run_id` column experiment retired.
- Audit Server column + nested `servers(name)` embed in `/api/audit` + `/api/audit/[id]`. Hard-Won Lesson: PostgREST returns to-one FK embeds as a single object at runtime; Supabase JS's generated TS types declare it as an array: cast through `unknown`.
- Audit detail Sheet policy verdicts get visual hierarchy: enforce-block red w/ "Cause" pill, shadow-block amber, redact orange, allow muted. Distinguishes the policy that actually halted the call from the ones that ran clean.
- WP-26.1 retire audit page 1Hz polling: replaced 50-line `setInterval` + Pause/Resume button with the same `DASHBOARD_REFRESH_EVENT` listener pattern Monitoring uses (`refreshTick` retrigger). One websocket per tab via shell-mounted `useRealtimeDashboardEvents`; many readers. ~50 lines deleted, zero new hooks.
- VISION.md → `docs/VISION.md` + 5 caller links updated. 1 commit (`b4fef47`). 344/2/0 tests, lint + typecheck + build clean.

## Current:

**Sprint 28: Route authoring MVP — de-risk on `feat/route-authoring` (READY TO MERGE)**

All six WPs shipped on `feat/route-authoring`. 970 insertions, 11 files,
356/2/0 tests, typecheck + lint + next build all clean, visual QA passed
end-to-end via Playwright (login → list → import dialog → load sample →
import → success → detail → copy as JSON → import error paths).

- [x] **WP-28.1** POST /api/routes (JSON import) — `dd13a57`. 4 files,
      lib/schemas/route-import.ts + lib/routes/import.ts + handler + 12 unit
      tests on the pure import function with mocked Supabase client. Sprint
      27 PostgREST single-object embed lesson reused.
- [x] **WP-28.2** DELETE /api/routes/[id] — `ff1fd40`. Mirrors relationships
      DELETE pattern. 404 (not 403) on cross-org/missing routes to avoid
      leaking existence. route_steps cascade via FK.
- [x] **WP-28.3** Routes list import dialog UI — `b71c4db`. shadcn Dialog +
      Textarea + Load sample button + Cancel/Import. Replaces the disabled
      "Create route Soon" placeholder. formatApiError special-cases
      duplicate, tool-not-found, and invalid-body with user-actionable hints.
- [x] **WP-28.4** Routes detail Copy as JSON button — `3b4fc7c`. Extended
      fetchRouteDetail with fallback_input_mapping +
      fallback_rollback_input_mapping (round-trip-complete). Export omits
      empty optionals + domain_id. Closes the import/export loop.
- [x] **WP-28.5** Tests + reviewer + Playwright QA. Each WP individually
      reviewed and Approved by `code-reviewer`. Visual QA captured 8
      screenshots through the full happy + error paths.
- [x] **WP-28.6** BACKLOG entry for v2 — Route Author UI v2 spec landed in
      BACKLOG.md P1 with full scope (visual editor, DSL autocomplete, step
      reordering, PATCH endpoint, compensator coverage validation,
      `(org, name)` UNIQUE constraint, docs page).

**Merge readiness:** all conditions met. Branch is `origin/feat/route-authoring`
at `3b4fc7c`. Main at `1963101`. Awaiting merge decision.

## Session Log
- 2026-04-26: Sprints 26+27 wrapped together. Sprint 26 = 11-commit dashboard UI refactor (servers + relationships + routes + connect + policies + tokens + chrome) over Sat night → Sun early AM, originally tagged 26-28 in commits, consolidated as one bulk TASKS.md entry. Sprint 27 = this session's audit work: per-Run trace_id refactor + audit Server column + audit detail visual hierarchy + WP-26.1 polling→DASHBOARD_REFRESH_EVENT listener (Monitoring pattern reuse). Key lesson: don't reinvent neighbor patterns. First WP-26.1 draft built generalized `useRealtimeMcpEvents` hook + Datadog Live Tail UX (Pause button, buffered count, auto-pause on scroll); user redirected to existing pattern → ~50 lines deleted, zero new chrome. PostgREST to-one-FK-as-array TS-types-lie gotcha caught when Server column rendered empty. 3 memories. 344/2/0 tests.
- 2026-04-25: Sprints 24+25 shipped: 4 commits unpushed. Sprint 24: Connect page (3-tier scope tabs, 4 client snippets, live Test connection) + Monitoring KPI hero strip + dropped hardcoded SalesOps domain from signup trigger + SiteHeader duplicate `<h1>` killed across all 11 pages. Sprint 25: server-config-snippet origin fix (same pattern as Connect), server cards rebuilt (health dot + traffic stat + ⋯ menu), server detail reflow (Origin status to top, scoped KPI strip, collapsed empty cards), overview cleanup (DataTable dropped, chart 7d default). Hard-Won Lessons #45/#46/#47. 6 memories. 344/2/0 tests on every commit.
- 2026-04-25: Sprint 23 shipped: 1 commit. Mid-sprint scope pivot: original plan was Connect page + charts + KPI strip; actual ship was charts unification + audit DataTable + audit timeline LineChart + range pickers (Monitoring + Audit) + auto-range pick. Datadog-grade polish: `lib/charts/palette.ts` single palette source, `lib/monitoring/range.ts` shared time-range vocabulary, `lib/audit/timeline.ts` server-side bucketing. Caught react-19 purity rule bouncing `Date.now()` in render → bucket on server. Caught barCategoryGap numeric collapse to 0.04px via Playwright SVG inspection. Connect page + KPI strip back to BACKLOG. 6 memories + Hard-Won Lessons #42/#43/#44. 344/2/0 tests.
