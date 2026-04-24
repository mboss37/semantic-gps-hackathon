# claude-hackathon — Task Tracker

> Claude: Read at session start. Keep focused — only current state + shipped history matters.
> Completed sprints: keep WPs listed (one line each). Session log: 3 lines max, last 3 sessions.

## Completed Sprints

**Sprint 1 — Setup:** Next.js 16 + React 19 + Tailwind 4 + TypeScript-strict + ESLint 9 scaffold, shadcn init, `supabase init`, `.env.example`, vitest smoke; all quality gates green.

**Sprint 2 — Infra foundation:**
- Hosted Supabase `cgvxeurmulnlbevinmzj` (Central EU) — production target only; local stack on :54321 (2026 `sb_publishable_*` / `sb_secret_*` key format)
- Migration pipeline proven local→hosted; Vercel live at https://semantic-gps-hackathon.vercel.app via Supabase Marketplace integration
- CLAUDE.md process rules locked: local-first Supabase, pull-from-backlog removes-from-backlog, completed sprints persist WPs

**Sprint 3 — Core spine + gateway skeleton + dashboard:**
- 3.1 Spine libs + 6-table schema (auth, proxy, SSRF, encrypt, manifest cache)
- 3.2 MCP gateway Inspector-verified on Vercel; echo tool E2E via Anthropic SDK
- 3.3 OpenAPI import + servers CRUD + TRel `discover_relationships` / `find_workflow_path`
- 3.4 Policy engine with shadow/enforce toggle (PII + allowlist built-ins)
- 3.5 Dashboard (shadcn dashboard-01) + MCP direct-import tool discovery
- 3.6 Demo agent deferred — reality-check against reference architecture rejected shipping on mocked execution

**Sprint 4 — Multi-tenant schema + real proxies (Wed Apr 22):**
- A.1/B.1 `organizations` + `memberships` + `domains` schema; `on_auth_user_created` trigger auto-seeds org + membership + default SalesOps domain on signup
- B.3 Relationship taxonomy cut to 8 canonical types (`produces_input_for`, `requires_before`, `suggests_after`, `mutually_exclusive`, `alternative_to`, `validates`, `compensated_by`, `fallback_to`)
- B.4 `policy_versions` audit table with insert/update trigger
- C.1 Real OpenAPI HTTP proxy — decrypt auth, SSRF-guarded fetch, 5xx retry
- C.2 Real direct-MCP HTTP-Streamable proxy — JSON-RPC + single-event SSE, Zod boundary validation
- Tier-1 Opus 4.7 → deployed `/api/mcp` → echo E2E in 4.87s

**Sprint 5 — Scoped gateway + routes schema + auth pages (Thu Apr 23):**
- C.3 Real-proxy default-on; typed `ExecuteResult` discriminated union
- C.5 `tools/list` emits `_meta.relationships` per tool when edges exist
- B.2 `routes` + `route_steps` tables with `fallback_route_id` + `rollback_tool_id` FKs
- D.1 Three-tier scoped gateway — `/api/mcp` (org) + `/api/mcp/domain/[slug]` + `/api/mcp/server/[id]`; shared `buildGatewayHandler(scopeResolver)` + per-scope manifest cache
- G.5 Pre-call policies `basic_auth` + `client_id` + `ip_allowlist` (fail-closed); `PreCallContext` threads headers + client_ip
- A.2 Supabase email/pw signup + login + logout pages; dev-login removed

**Sprint 6 — Orchestration + gateway auth + authoring UI:**
- D.2 Gateway bearer-token auth via `gateway_tokens` (org-scoped, SHA-256 hashed); distinct JSON-RPC error reasons with `error.data.reason`
- F.1 `execute_route` MCP method — ordered step execution with `input_mapping` DSL (`$inputs.*` + `$steps.<key>.<path>`), per-step policies, capture bag, chained traceId audit
- G.6 Semantic rewriting — `tools.display_name` + `display_description` nullable columns; origin wins on collision
- G.4 Rate-limit + injection-guard runners; per-builtin config forms replace JSON textarea
- G.2 Relationship CRUD API + dashboard UI with cross-org enforcement
- Service-client hardening — fail-loud on missing env (addresses Vercel Sensitive env-var dropout #38722)

**Sprint 7 — Real Salesforce + token UI + fallback:**
- A.6 Gateway token mint + rotate UI at `/dashboard/tokens`; plaintext shown once, SHA-256 hashed in DB
- F.2 Fallback execution — `execute_route` walks `fallback_to` on origin_error, emits `fallback_triggered` audit event
- E.1 Salesforce OAuth 2.0 Client Credentials + 5 tools (find_account, find_contact, get_opportunity, update_opportunity_stage, create_task); raw fetch, no jsforce
- J.3 `sales_escalation` route seeded — 3 steps with F.1 input mapping (`$inputs.account_name` → `$steps.account.records.0.Id`)
- CI fix — DB-integration suites skip on Actions; route suites stub `@/lib/supabase/service` via chainable Proxy helper

**Sprint 8 — Cross-MCP orchestration + Playground A/B hero (Thu Apr 23):**
- E.2 Slack proxy — 3 tools (users_lookup_by_email, chat_post_message, conversations_list) via Bot Token
- E.3 GitHub proxy — 4 tools (search_issues, create_issue, add_comment, close_issue) via PAT; response projection trims payloads
- F.3 Rollback execution — `execute_route` walks `compensated_by` in REVERSE on any halt; shared `UpstreamError` across 3 proxies
- J.3-ext Cross-MCP seed — Slack + GitHub servers + 7 cross-MCP relationships + `cross_domain_escalation` route
- J.1 Playground A/B — `/dashboard/playground` two-pane workbench, same Opus 4.7 client, `/api/mcp/raw` vs `/api/mcp`. User caught tool-count asymmetry mid-sprint → refactored to honest A/B with shared `{governed: boolean}` server factory
- I.2 Rollback cascade viz with 400ms edge-highlight stagger
- G.1 `validate_workflow` + `evaluate_goal` real implementations; Opus 4.7 second-tier ranker with keyword-first fallback
- Demo E2E live locally via Cloudflare tunnel + on Vercel against real SF/Slack/GH

**Sprint 9 — Gateway-native policy set + demo presets (Fri Apr 24):**
- G.10 `business_hours` builtin — timezone-aware, DST-safe via `Intl.DateTimeFormat.formatToParts()`
- G.11 `write_freeze` kill-switch — disabled by default so the demo flips live
- G.9 Tool-level policy assignment UI — grouped server→tool Select with cross-org guard
- J.4 Playground preset overhaul — 3 scenarios each isolate one governance dimension
- J.5 Idempotent policy seed script — DELETE-by-name + `NULL::uuid` casts on global assignments
- Refactor: `policy-config-forms.tsx` split into 9 per-builtin files (549→142 lines)
- G.12 `budget_cap` retired in planning — principle cemented: gateway governs the CALL, downstream governs the DATA

**Sprint 10 — Policy taxonomy completion + demo-readiness bundle (Thu Apr 23 PM):**
- G.13 `geo_fence` (EU AI Act hook) + G.14 `agent_identity_required` (Meta confused-deputy hook) + G.15 `idempotency_required` (duplicate-request dedupe) — completes 12 builtins across 7 governance dimensions
- G.16 Env-driven Anthropic model IDs — fail-loud on missing env; Playground default Sonnet for cost, `evaluate_goal` keeps Opus
- Refactor: `built-in.ts` split 562→57 lines into 12 per-runner files
- `scripts/bootstrap-local-demo.sql` — idempotent SQL mirroring hosted to local (3 MCPs, 12 tools, 10 edges, 2 routes, 4 policies)
- libphonenumber-js replaces hand-rolled PII regex — international, rejects dates/IPs/ZIPs/UUIDs via real numbering-plan validation
- Canonical saga pattern — `route_steps.rollback_input_mapping jsonb` + `CapturedStep {args, result}` bag replaces Sprint 8 result-passthrough stub
- `docs/DEMO.md` recording playbook; CLAUDE.md hard rules (seed local first, local=superset of hosted)
- 4 demo stories E2E validated against real SF/Slack/GitHub on local — PII hero promoted after Slack-auto-linkify visual beat

**Sprint 11 — Submission gates + vision signaling + demo-day ergonomics (Thu Apr 23 PM):**
- 11.1 CNA landing replaced with Semantic GPS page + Supabase `?verified=true` email-verify ack handler
- 11.2 `README.md` full rewrite — pitch, quickstart, env table, architecture overview, vision teaser
- 11.3 `docs/SUBMISSION.md` — CV-platform 150-word summary + 25-word elevator pitch
- 11.4 `VISION.md` in repo root (~600 words) — split control/data plane, Rust data plane deploy-anywhere, Next.js multi-region control plane, Navigation Bundle sync, roadmap. Sits next to README in GitHub's root listing for judge visibility.
- 11.5 `scripts/cleanup-demo-data.mjs` — idempotent recording-day reset CLI with `--dry-run`, per-subsystem error isolation, SOQL double-escape parity with `proxy-salesforce.ts`
- 11.6 Policy row Select → ToggleGroup — 1-click shadow↔enforce flip for live demo narrative

**Sprint 12 — Opus amplifier + saga honesty + dev-workflow cleanup (Thu Apr 23 PM):**
- 12.1 Extended-thinking blocks in Playground — `thinking: {type:'enabled', budget_tokens:2048}` + `max_tokens:8192` on both panes; new `ThinkingEvent` NDJSON type; collapsible `<details>` reasoning panel with char count. Honest-A/B principle extended to model capabilities.
- 12.2 Compensation edges for Slack + SF — new `delete_message` (Slack `chat.delete`) + `delete_task` (SF REST DELETE, widened `CallInit.method`) tools; 2 new `compensated_by` edges; `rollback_input_mapping` on cross_domain_escalation steps 4+5; hosted DB synced with parity UUIDs.
- 12.3 Manifest cache invalidation endpoint — `POST /api/internal/manifest/invalidate`, dev-gated via `NODE_ENV` + `MANIFEST_INTROSPECTION_ENABLED`; `__HMR_NONCE__` export + comment deleted. **Subagent caught Next.js `_`-prefixed folders are private and excluded from routing** — added as Hard-Won Lesson #21.
- 12.4 Policy shadow→enforce timeline — `GET /api/policies/[id]/timeline?days=N` (Zod 1-30, default 7), JS-side jsonb filter on `policy_decisions` array, zero-filled daily buckets. `/dashboard/policies/[id]` page + Recharts stacked bars (allow/shadow_block/enforce_block). "View timeline" link added to PolicyRow.
- Validations: 269 pass / 5 skip / 0 fail, tsc + lint + `next build` clean, local db reset clean, hosted synced. 1 commit pushed to main.

**Sprint 13 — Route visibility + self-serve + polish (Thu Apr 23 PM):**
- 13.1 Route designer UI — new `/dashboard/routes` list + `/dashboard/routes/[id]` detail. Read-only React Flow canvas per route with step nodes (horizontal pipeline) + rollback ghost above + fallback preview below; click step → side panel with input_mapping, rollback_input_mapping, fallback route name, rollback tool name. `lib/routes/fetch.ts` with cross-org null return + two-stage lookup (tools + fallback routes by id) to avoid PostgREST FK ambiguity.
- 13.2 Per-server detail page — new `/dashboard/servers/[id]` with tools list + 7-day policy violation counts aggregated from `mcp_events` + copy-ready MCP client config snippet (placeholder token, no real tokens) + live `resources/list` + `prompts/list` JSON-RPC introspection via SSRF-guarded safeFetch with 3s timeout + -32601 → empty list handling. "View details" link added to ServerCard. Reviewer caught service-role Supabase client leak in page.tsx → fixed by threading `authConfig` as server-only internal field on `ServerDetail`.
- 13.3 Monitoring page — new `/dashboard/monitoring` with 3 Recharts widgets over `mcp_events`: call volume stacked (ok/blocked/error), policy blocks stacked per-policy (top 5 + other), PII detections horizontal bars. `lib/monitoring/fetch.ts` with JS-side jsonb array grouping. `PII_PATTERN_NAMES` + `extractPiiPatternFromSample` helpers extracted from pii-redaction runner as single source of truth (dashboard imports, never parallels). Subagent B shipped incomplete — main thread finished page + 3 charts + tests + sidebar nav.
- 13.4 business_hours multi-window + overnight — config evolved to `{timezone, windows: [{timezone?, days[], start_hour, end_hour}]}`. Overnight wrap via `start > end` semantics + `dayBefore` helper (Fri 22-04 matches Sat 01:00 via Fri-is-day-before). Allow-list semantics (any window match → pass). `z.union([NewShape, LegacyShape.transform(...)])` backcompat — zero DB migration, legacy single-window configs parse seamlessly. Form rewritten with `WindowRow` subcomponent + add/remove buttons + overnight hint. Extended from 4 → 12 test cases including DST, per-window tz override, overnight morning/evening portions.
- Sat P0 queued post-sprint: landing page rewrite (highest ranking lever), extract SF/Slack/GitHub to standalone MCPs, onboarding wizard, data-model audit. Competition-mindset rules added to CLAUDE.md (judging signal order, visual polish mandatory, proactive critic mandate).
- Validations: 291 pass / 5 skip / 0 fail (+22 net), tsc + lint + `next build` clean. 3 commits pushed to main (feat + 2×chore).

**Sprint 14 — Dashboard polish (Thu Apr 23 evening):**
- 14.1 Overview chart real data — new `/api/gateway-traffic` (GET, range=7d|30d|90d) reusing `fetchCallVolume`; `components/chart-area-interactive.tsx` rewritten to fetch live, 3-series stacked (ok/blocked/error) matching monitoring palette; 2024 hardcoded fixture retired.
- 14.2 Origin health probes (F.4) — new `/api/servers/[id]/health` with safeFetch HEAD→GET 2s timeout, status `ok|degraded|down|unknown`; `ServerHealthBadge` client component replaces "Health probes arrive with F.4" placeholder on server detail page; includes refresh button + last-checked timestamp.
- 14.3 Rediscover tools — new `/api/servers/[id]/rediscover` POST, name-keyed diff upserting description/input_schema while preserving `display_name`/`display_description` overrides; `ServerRediscoverButton` client component on server detail header with 8s auto-clear status; `decodeAuthConfig` extracted to `lib/servers/auth.ts` (single source of truth for encrypted envelope + legacy plaintext); `loadServer` + `applyDiff` helpers keep POST under 50-line cap.
- Review-flagged fixes applied: rediscover handler helper extraction (86→45 lines), chart no-flicker on range change, rediscover status auto-clear. 1 reviewer suggestion (remove `queueMicrotask` in ServerHealthBadge) reverted — the `react-hooks/set-state-in-effect` lint rule DOES fire on memoized setState-callers invoked directly in effect body; kept the deferral with explanatory comment.
- BACKLOG: new P1 "Identified issues" subsection captures deferred review items (5-file auth-decode dup, Promise.all → upsert needs unique constraint, console.error Supabase body leaks, rediscover dry-run preview endpoint).
- Subagent B (14.3) exited mid-WP notification — main thread caught via git-status + missing-file verify (Sprint 13 lesson holding up); finished button component + test + page header edit in the main session.
- Validations: 302 pass / 5 skip / 0 fail (+11 net), tsc + lint + `next build` clean with 3 new routes. 1 commit `4a17a64` pushed to main.

**Sprint 15 — Enterprise shape (Fri Apr 24):**
- C.6 Extract vendor proxies — SF/Slack/GitHub reshaped as in-process `app/api/mcps/<vendor>/` MCP-HTTP-Streamable routes; dispatcher narrowed to `openapi | http-streamable`; 6 lib files + 6 tests retired; new 5-file vendor adapter folder + 3 new route test suites.
- K.1 Enterprise data-model audit — migration `20260424140000_enterprise_schema_audit.sql` adds `mcp_events.organization_id` (threaded through `ExecuteRouteCtx` + 26 `logMCPEvent` sites), `organizations` billing metadata (plan/trial/email/created_by), `memberships.role` widened to `admin|member`, `memberships.profile_completed` for A.7 gate. Two Hard-Won Lessons captured (#23 SSRF-localhost dev flag, #24 replace_all indent trap).
- A.7 First-signup onboarding wizard — `/onboarding` page + client form + server action; `proxy.ts` + dashboard layout gate on `profile_completed`; retires `<handle>'s Workspace` auto-hack.
- Post-sprint multi-tenancy sweep (smoke-test finding) — migration `20260424150000_multitenant_policies.sql` adds `organization_id NOT NULL` to `policies` + `policy_assignments`; every dashboard page, API route, and manifest loader org-scopes via `requireAuth()`; Graph page killed its unauth'd `/api/mcp` browser fetch via new `fetchGraphData` server action; gateway-handler now captures request headers on auth failures; nav rebuilt with real session user + working logout.
- Hosted migration sync — earlier version-timestamp drift resolved; all 19 migrations now Local==Remote. Supabase CLI only recognizes 14-digit filenames (Hard-Won Lesson #25).
- Validations across the sprint: 288 pass / 2 skip / 0 fail, tsc + lint + `next build` clean. Hosted mirrored. 7 commits pushed to main (f0127f1 → 88e1815).
- BACKLOG: L.1 RLS queued as next P0; migration-id-drift prevention queued for Sprint 16. 5 follow-up suggestions rolled up (route_steps scoping done inline; gateway-handler URL redaction + bootstrap wrapper + assignments handler size + shadcn style sweep all P1).

**Sprint 16 — Enterprise hardening / Postgres RLS (Fri Apr 24 PM CET):**
- L.1 Postgres RLS on all 13 tenant tables — migration `20260425150000_enable_rls_tenant_tables.sql` ships `custom_access_token_hook` (stamps `organization_id` into JWT on every token issuance), `public.jwt_org_id()` helper, `org_isolation` policies on every tenant table (direct scope on 9 tables + parent-join on tools/relationships/route_steps/policy_versions). Service-role bypass keeps gateway + audit + manifest paths untouched.
- L.1 follow-up tighten migration `20260425160000_rls_member_update_tighten.sql` — reviewer caught `member_update_self` tenant-escape (USING + WITH CHECK both pinned only to `user_id = auth.uid()` → user could `UPDATE memberships SET organization_id = '<victim>'`). Fixed by pinning WITH CHECK to `organization_id = jwt_org_id() AND role = 'admin'`. New Hard-Won Lesson #27 cemented.
- L.1 auth callback handler — `app/auth/callback/route.ts` exchanges PKCE code for session after Supabase email verification; signup page passes `emailRedirectTo: ${origin}/auth/callback`. Supabase dashboard URL allowlist + hook registration documented as operational prereqs. New Hard-Won Lessons #26 (hook dashboard registration isn't migratable) and #28 (Vercel preview deployment 401s auth routes) captured.
- L.1 test coverage — new `__tests__/rls-org-isolation.vitest.ts` with 9 assertions: JWT claim injection, cross-org SELECT on direct + parent-join tables, cross-org INSERT WITH CHECK rejection, cross-org UPDATE tenant-escape rejection, self-SELECT positive control. Hosted validated end-to-end via 3-org IDOR sweep (mboss37 + johny + rls-test-b accounts, 3 resources × 3 orgs → all foreign URLs 404, all own URLs resolve).
- M.1 migration workflow hardening — new `.claude/rules/migrations.md` path-scoped rule; CLAUDE.md Off-Limits entry banning MCP `apply_migration` against hosted; `docs/ARCHITECTURE.md` new "Migration workflow" subsection with the drift-mechanism explanation.
- Hard-Won Lesson #29 — Supabase built-in SMTP locked at 2 emails/hour, only editable with custom SMTP configured. Dev workaround is "Confirm email" toggle off; production unlocks via Resend.
- BACKLOG: 3 new P0 NEXT-SPRINT surfaced during validation — policy catalog gallery (Mulesoft pattern — zero-policy new users need a browsable 12-runner catalog), playground token auto-mint consent violation (system-owned `kind='system'` tokens, never displayed), playground no-MCP guard (disable Execute when zero servers).
- Validations: 297 pass / 2 skip / 0 fail (+9 from RLS assertions), tsc + lint + `next build` clean. Hosted: migrations 1-21 Local==Remote, RLS live on all 13 tables, hook registered in dashboard. 1 commit `8b97167` pushed to main.

## Current: Sprint 17 — Pre-launch hygiene (Fri Apr 24 PM CET)

Close the 3 P0 NEXT-SPRINT items surfaced during Sprint 16 RLS validation + absorb the Sat-AM empty-state audit tonight so Saturday is pure polish (narrative + landing rewrite). Buys a stable, polished dashboard surface for Sat-AM soft-launch + Sat-PM landing screenshot grid. Biggest judging-signal move = the policy catalog gallery (Mulesoft pattern) — judges signing up see the 12 builtin runners as the product, not an empty page.

- [x] **17.1** (M) Policy catalog gallery — new `/dashboard/policies/catalog` with cards for all 12 builtin runners, each with name + description + config schema preview + "Apply to my org" CTA deep-linking into existing create-instance form. Zero auto-seeding. (Main thread — strategic UI + approval-gated.)
- [x] **17.2** (S) Playground token consent fix — migration adds `gateway_tokens.kind text` ('user'|'system'); tokens-UI filters `kind='user'`; `mintPlaygroundToken()` reads-or-creates the single `kind='system'` row. (Subagent lane A.)
- [x] **17.3** (S) Playground no-MCP guard — `/dashboard/playground` loads server count on mount, disables Execute with inline register-a-server CTA when count is 0. (Subagent lane B.)
- [x] **17.4** (M) Empty-state dashboard audit — fresh signup on hosted, click every nav item, fix crashes + honest empty states. Risk areas: overview chart, monitoring widgets, workflow graph, routes/audit/policy/relationships lists. (Subagent lane C — exploratory + inline fixes.)

## Session Log
- 2026-04-24 — Sprint 16 shipped: L.1 RLS (13 tables, custom hook, 9 isolation tests, 3-org hosted IDOR sweep) + M.1 migrations rule. Follow-up auth callback handler ships PKCE flow. Reviewer caught member_update_self tenant-escape → tighten migration shipped as follow-up. 3 new P0 surfaced for Sprint 17 (policy catalog UI, playground token consent, signup UX polish). 1 commit pushed.
- 2026-04-24 — Sprint 15 shipped: 3 WPs (C.6 + K.1 + A.7) + post-sprint multi-tenancy sweep (11 tables scoped, graph unauth'd fetch killed, nav rebuilt). Smoke testing under a 2nd signup account surfaced the cross-org leaks that the original WPs missed — fixed in place, 288/2/0. L.1 RLS added as next P0 for defense-in-depth. 7 commits pushed.
- 2026-04-23 — Sprint 14 shipped: 3 WPs (14.1 overview live + 14.2 origin health + 14.3 rediscover). Subagent B bailed mid-WP, main finished the gap. Reviewer approved with 8 suggestions; fixed 4 easy, BACKLOG'd 4 risky in new P1 "Identified issues" subsection. 302/5/0. 1 commit pushed.
