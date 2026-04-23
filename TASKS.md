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

## Current:

## Session Log
- 2026-04-23 — Sprint 11 shipped: submission-gate landing replacement, README + SUBMISSION.md + root VISION.md, demo-data cleanup CLI, policy row ToggleGroup. 10 files (+515/-91), 1 commit, pushed. Code review clean; three preemptive fixes applied (NaN guard, SOQL escape parity, GH window comment).
- 2026-04-23 — Sprint 10 shipped + wrapped: G.13/G.14/G.15/G.16 completing 12-builtin policy taxonomy + demo-readiness bundle (local bootstrap, libphonenumber-js PII, canonical saga rollback, DEMO.md playbook). 4 demo stories E2E validated live. 5 memories harvested. 256/5/0.
- 2026-04-24 — Sprint 9 shipped + wrapped: 5 WPs (G.10/G.11/G.9/J.4/J.5) + `policy-config-forms.tsx` 9-file split. G.12 budget_cap retired mid-sprint — "gateway governs the CALL, downstream governs the DATA" cemented into CLAUDE.md + ARCHITECTURE.md.
