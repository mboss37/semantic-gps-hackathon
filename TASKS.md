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

## Current: Sprint 19 — Reviewer findings sweep (15 items)

**WP-19.1: Doc + cosmetic + sidebar sweep**
- [ ] DEMO.md Story #1 arg name fix (`account_name` → `query`)
- [ ] `chart-area-interactive.tsx:167-238` indent fix
- [ ] shadcn components style sweep (single-quote + semis: nav-user, app-sidebar, nav-main, site-header)
- [ ] Dual sidebar "Policies" + "Policy Catalog" → demote catalog entry

**WP-19.2: Onboarding fixes**
- [ ] `onboarding/actions.ts:47-55` let-ctx style → dedicated helper
- [ ] Onboarding `created_by` clobber on retry → `.is('created_by', null)` guard

**WP-19.3: Security defense-in-depth**
- [ ] `gateway-tokens/[id]/route.ts` DELETE missing `kind` filter → `.neq('kind', 'system')`
- [ ] `gateway-handler.ts` auth-fail payload leaks `request.url` query params → strip search
- [ ] `console.error` leaking Supabase error bodies — sweep ~10 route handlers

**WP-19.4: Code extraction & dedup**
- [ ] Auth-config decode duplication in `proxy-openapi.ts` + `proxy-http.ts` → consolidate to `lib/servers/auth.ts`
- [ ] `policies/[id]/assignments/route.ts` POST at 88 lines → extract `verifyAssignmentTarget`
- [ ] `mintPlaygroundToken` extract to `lib/mcp/playground-token.ts` + reuse-branch test

**WP-19.5: Script hardening**
- [ ] `bootstrap-local-demo.sql` hardcodes `localhost` → `psql -v base_url=...` templating
- [ ] `bootstrap-local-demo.sql` silent no-op when demo membership missing → fail-loud

**WP-19.6: File splits**
- [ ] `execute-route.ts` (794 lines) → extract `executeRollback` to `lib/mcp/execute-rollback.ts`
- [ ] `playground-workbench.tsx` (485 lines) → extract `PaneView` + event reducer + scenarios

**WP-19.7: Rediscover overhaul**
- [ ] Upsert batch instead of N individual UPDATEs (+ UNIQUE constraint migration)
- [ ] Dry-run preview GET endpoint + confirmation UI before applying diff

**WP-19.8: Auth hook enhancements**
- [ ] Fold `profile_completed` into JWT custom claim → remove DB query from `proxy.ts`
- [ ] `custom_access_token_hook` LIMIT 1 → add `active_org_id` user metadata + prefer it in hook

**WP-19.9: Rollback cascade regression (P0 demo-blocker)**
- [ ] Unwrap MCP envelope (`{content:[{type:"text", text:"<JSON>"}]}`) at capture-bag write in `execute-route.ts` so `$steps.<key>.result.<field>` resolves against the logical object, not the wrapper. Unblocks demo story #9.

## Session Log
- 2026-04-24 — Sprint 18 shipped: 3 WPs (specialist prework + landing v0 + end-to-end deploy signup validation). Bonuses mid-WP-3: `/signup/check-email` industry page, `/login` `?error=` surfacing, hosted migration 22 push closing a week-old Sprint 17 drift. New Hard-Won Lesson #32 + `migrations.md § Sprint wrap` gate pin the drift class. Four memories stored. 327/2/0. 6 commits.
- 2026-04-24 — Sprint 17 shipped: 4 WPs (catalog gallery + token consent + no-MCP guard + empty-state audit). Parallel subagent `git stash` collision wiped 17.2's work mid-sprint; main thread reconstructed + follow-up commit mandated `isolation: worktree` frontmatter on write-capable subagents. 4 new memories + 2 Hard-Won Lessons pin the fix. 327/2/0. 5 commits.
- 2026-04-24 — Sprint 16 shipped: L.1 RLS (13 tables, custom hook, 9 isolation tests, 3-org hosted IDOR sweep) + M.1 migrations rule. Follow-up auth callback handler ships PKCE flow. Reviewer caught member_update_self tenant-escape → tighten migration shipped as follow-up. 3 new P0 surfaced for Sprint 17. 1 commit pushed.
