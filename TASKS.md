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
- **Sprint 6 — Orchestration + gateway auth + authoring UI (Wed 2026-04-22):**
  - A.4 Removed dev-login bypass entirely — signup/login via `/login` only; seed.sql top comment updated; zero call sites remain
  - D.2 Gateway bearer-token auth — `gateway_tokens` migration (org-scoped, SHA-256 hashed), `lib/mcp/auth-token.ts` (parseBearer + hashToken + resolveOrgFromToken with fire-and-forget last_used_at bump), auth enforced in `buildGatewayHandler`, demo token seeded; 5-case test matrix
  - F.1 `execute_route` MCP method — `lib/mcp/execute-route.ts` orchestrator, ordered step execution, `input_mapping` DSL (`$inputs.<prop>` + `$steps.<capture_key>.<dot.path>` with numeric indices), per-step `runPreCallPolicies` / `runPostCallPolicies`, capture bag, halt-on-error with `halted_at_step`, chained `traceId` audit, MCP `structuredContent` + JSON text wrapper
  - G.6 Semantic rewriting layer — `tools.display_name` + `display_description` nullable columns; `tools/list` emits display values (fallback to origin); `tools/call` accepts either origin or display name (origin wins on collision); builtin echo unchanged
  - G.4 Rate-limit + injection-guard runners — in-memory Map rate limiter (60s window, cleanup-on-read) keyed on `x-org-id` > `client_ip` > 'anon'; injection-guard with 5 default patterns (ignore_prior, role_override, im_start, sql_drop, sql_comment_inject); per-`builtin_key` policy config forms replace JSON textarea; 7-key enum in API
  - G.2 Relationship CRUD API + dashboard UI — `app/api/relationships/{route,[id]/route}.ts` with cross-org enforcement via tool→server→org join; `/dashboard/relationships` table + create dialog + inline description edit; sidebar entry; node-detail panel "+" shortcut pre-fills from-tool
  - **Postmortem fix (not planned):** service-client hardening — `lib/supabase/service.ts` throws on missing `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` instead of silent `?? ''`; gateway-handler wraps in try/catch and returns 4 distinct JSON-RPC reasons (`missing_authorization` 401, `invalid_token` 401, `upstream_db_error` 502, `server_misconfigured` 500) with `error.data.reason` + optional `detail` — addresses Vercel Sensitive env-var dropout (community bug #38722)
  - Validations: 132/132 tests ✓, lint 0 ✓, tsc 0 ✓, `next build` clean ✓; 8 commits pushed to main
- **Sprint 7 — Day 2 night: real Salesforce integration + token UI + fallback (Wed 2026-04-22 evening):**
  - A.6 Gateway token mint + rotate UI — `/dashboard/tokens` + POST/GET/DELETE `/api/gateway-tokens`, plaintext shown ONCE with explicit-dismiss modal, SHA-256 hashed in DB, sidebar entry. Closes the hosted bootstrap gap. 6-test matrix.
  - F.2 Fallback execution — `execute_route` auto-tries `fallback_to` edge on `origin_error`, emits `fallback_triggered` audit event sharing route's traceId, `fallback_used` + `fallback_also_failed` optional fields on `ExecuteRouteStep`. Single-level structural guard (fallback path never re-enters `runSingleStep`). 4 tests.
  - E.1 Salesforce OAuth 2.0 Client Credentials + 5 curated tools (find_account, find_contact, get_opportunity, update_opportunity_stage, create_task). No jsforce — raw fetch keeps bundle edge-compatible. Auth seam at `lib/mcp/salesforce-auth.ts` + call/dispatch at `lib/mcp/proxy-salesforce.ts` (both under 400-line cap; refactor split mid-review). Module-level token cache with 60s skew. 9 mocked tests + 1 opt-in `VERIFY_SALESFORCE=1`.
  - J.3 Real demo seed loaded via Supabase MCP — 1 Demo Salesforce server (encrypted auth_config from local one-shot helper `scripts/seed-j3-encrypt.mjs`), 5 tools, Route `sales_escalation` with 3 steps + F.1 input_mapping (`$inputs.account_name` → `$steps.account.records.0.Id`), 3 relationships (2 produces_input_for + 1 requires_before), 2 policies (PII shadow + allowlist enforce) + assignments. Migration `20260422210000_transport_salesforce.sql` widened CHECK to include `'salesforce'` (E.1 had widened only the TS union — every INSERT would have hit `check_violation`).
  - **Infra fix (not planned):** CI had been red for 4 commits since Sprint 6. Three-pronged fix: (1) `.github/workflows/ci.yml` gets fake Supabase/encryption env so `createServiceClient` boots + `lib/crypto/encrypt.ts` decodes; (2) 6 DB-integration suites (`auth-org`, `domains`, `gateway-scoped`, `policy-versions`, `relationships-api`, `routes`) widened to `&& !process.env.CI` so they skip on Actions; (3) 4 route suites stub `@/lib/supabase/service` on CI via `__tests__/_helpers/supabase-stub.ts` (Proxy-based chainable that resolves `{data:[],error:null}`) so `logMCPEvent`'s fire-and-forget insert doesn't hang on the fake URL. Bonus: ESLint `argsIgnorePattern: '^_'` honors TS unused-prefix convention.
  - Validations: 151 pass / 3 skip locally, 129 pass / 25 skip on CI, tsc 0 ✓, lint 0 ✓, `next build` clean ✓; 7 commits pushed to main; CI green for first time since Sprint 6. Deployed Vercel gateway end-to-end verified: bearer → manifest → dispatcher → SF OAuth → SOQL → real `Edge Communications` account row.

## Current:
_Sprint 7 closed Wed night. Sprint 8 (Fri Apr 24) candidates from `BACKLOG.md` — demo-production day. Critical path: J.1 Playground A/B (L) hero pane + I.1 extended-thinking live render + F.3 rollback + I.2 cascade viz. Stretch: G.1 (validate_workflow + evaluate_goal). Recording day Sat — see `[P0 Sat AM]` in BACKLOG. Hosted is fully demo-ready (token, route, relationships, policies, real SF tools)._

## Session Log
- 2026-04-23 — Sprint 5 Day 2 shipped + wrapped: 6 WPs, 4 commits, three-tier scoped gateway live on Vercel, `REAL_PROXY_ENABLED` default-on, routes/route_steps schema ready for F.1, Supabase auth pages replace dev-login. Reviewer caught Next 16 `useSearchParams` Suspense blocker pre-build — codified `next build` into pre-commit gate. 7 hardening items queued in BACKLOG.
- 2026-04-22 — Sprint 6 shipped + wrapped: 6 WPs + 2 postmortem fixes, 8 commits. F.1 `execute_route` orchestrator, D.2 bearer auth, A.4 dev-login gone, G.6 semantic rewriting, G.4 rate-limit/injection-guard + policy UI, G.2 relationship CRUD. Lost ~30 min chasing Vercel "Sensitive" env-var dropout → hardened service-client throw + distinct JSON-RPC error reasons so next recurrence is a 1-minute diagnose. 5 memories harvested.
- 2026-04-22 — Sprint 7 shipped + wrapped (evening): 4 planned WPs (A.6, F.2, E.1, J.3) + 4 hardening commits (chore/ci, transport CHECK, integration-test gate, service-client stub), 8 commits. Deployed gateway proven E2E: Opus 4.7 → bearer → SF OAuth Client Credentials → real SOQL response. Two parallel sub-agents shipped A.6+F.2 in lane while main built E.1; J.3 tail-chained via Supabase MCP. 4 memories harvested (SF OAuth flow, manifest cache invalidation, vi.mock hoisting, CHECK-vs-union drift).
