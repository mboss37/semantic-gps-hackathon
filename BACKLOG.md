# claude-hackathon - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

---

## Sat deliverables — hard gates for submission

### [P0 Sat AM] Finalize demo narrative — decouple from code
Code ships regardless of framing. Nail the story Sat morning before recording, once all MCPs + routes + policies are live and we can see what the demo actually looks like on screen.

**Constraint:** avoid positioning Semantic GPS as an Agentforce competitor (Mihael works at Salesforce). Safer angles to evaluate:
- **"Complements Agentforce"** — Agentforce for in-SF agents, Semantic GPS for cross-surface (GH + Slack + custom). SF is system-of-record; governance happens on the outbound hops (PII redact into GH issues, Slack messages).
- **AI security / trust angle** — recent news around AI agent leaks, prompt injection, data exfiltration lines up with the gateway's actual capabilities (PII redact, injection-guard, policy enforce, rollback). Natural fit for the "Keep Thinking" $5K side prize.
- **DevOps-first fallback hero** — GH issue → Linear/Jira → Slack → PagerDuty. SF stays registered for breadth but isn't the protagonist. Lowest-risk framing if the other two still feel close to the line.

**Deliverables once framing is picked:**
- [ ] One-line pitch (≤15 words) for the video voiceover + README
- [ ] Left-pane / right-pane script for the Playground A/B beat (what "chaos" looks like vs "governed")
- [ ] PII policy target (which tool's output gets redacted on enforce)
- [ ] README positioning paragraph

### [P0 Sat AM] Record demo clip — CANNOT SLIP
Hero scenario recorded 5 takes minimum on Saturday morning using the deployed Vercel URL. Mirror-upload to YouTube (unlisted) + Loom + Google Drive. Saturday recording IS the submission video — Sunday is for summary + upload only, not for debugging.

- [ ] Record hero scenario (~75s) + OpenAPI import (~45s) + workflow graph (~30s) + intro/outro (~30s) = 3 min
- [ ] Cut in iMovie / DaVinci, scripted voiceover, no "um"s
- [ ] Upload to YouTube unlisted + Loom + Drive; paste all 3 URLs into `docs/SUBMISSION.md`

### [P0 Sat PM] README + submission summary
Replaces CNA boilerplate. **Required for submission.**

- [ ] `README.md` — one-paragraph pitch, quickstart (`supabase start` → `.env.local` → `pnpm dev`), env table, Vercel link, demo video embed
- [ ] `docs/SUBMISSION.md` — 100–200 word written summary for CV platform

### [P0 Sat] Replace CNA landing + email-verify acknowledgement
CNA branding leaks into `app/layout.tsx` tab title + `app/page.tsx` marketing shell. Separately: Supabase's email-verification link 302s users to our site URL (`/`) on success. Currently that lands on the CNA stub with zero acknowledgement. Fix both together before recording.

- [ ] `app/layout.tsx` — replace metadata (`title: "Create Next App"`, description)
- [ ] `app/page.tsx` — thin Semantic GPS landing with "Open Dashboard" CTA (or direct redirect to `/dashboard` when logged in)
- [ ] Handle `?verified=true` query param on the landing (or a dedicated `/auth/confirm` route handler) — show a success banner / toast so email-click feedback is visible, then redirect to `/dashboard` after 2s

---

## Sprint queue — daily pulls from here

Originally planned as a 42-WP mega-sprint. Collapsed to daily-sprint cadence 2026-04-22 (CLAUDE.md sweet spot = 3-6 WPs/sprint). Shipped: Sprint 4 Day 1 (A.1, B.1, B.3, B.4, C.1, C.2), Sprint 5 Thu (A.2, B.2, C.3, C.5, D.1, G.5), Sprint 6 (A.4, D.2, F.1, G.2, G.4, G.6), Sprint 7 (A.6, F.2, E.1, J.3 + transport CHECK migration + CI hardening). Sprint 8 in-flight (E.2, E.3, J.3-ext, F.3, I.2, J.1). **15 WPs remaining post-Sprint-8 pull.** Dep convention: `← blocked by X` / `→ blocks Y`. Sizes: S <1h, M 1-3h, L >3h. Pull rule: morning picks WPs whose `← blocked by` edges all landed.

**Projected judge card (all P0 landing):** Impact 9 · Demo 9 · Opus 4.7 Use 8 · Depth 9 → ~87% weighted.

**Critical path remaining:** Sprint 8 (E.2 + E.3 → J.3-ext → J.1) → Sat recording. G.1 + I.1 as stretch post-J.1.

### A. Platform — Auth + Org + Settings
- [ ] **A.3** (S) Password reset flow (request + submit). ← A.2
- [ ] **A.5** (S) Settings page — username + org name edit. ← A.1, A.2

### C. Real proxy layer
- [ ] **C.4** (M) Multi-origin per server + health-driven origin swap. ← C.3, F.4 → F.2

### E. Real integrations
_(all shipped or pulled into Sprint 8)_

### F. Routes + stateful orchestration
- [ ] **F.4** (S) Origin health probes (`/api/health/:server_id`, cached flag). ← B.1 → C.4, G.7

### G. TRel completion + policies + authoring UI

**Policy taxonomy (locked).** Semantic GPS governs the CALL; downstream systems govern the DATA. Policies must be gateway-native:
- **Time / state gates:** `business_hours` ✓, `write_freeze` ✓, maintenance windows
- **Rate limiting (gateway abuse):** `rate_limit` ✓
- **Identity + attribution:** `client_id` ✓, `agent_identity_required`
- **Network / data residency:** `ip_allowlist` ✓, `geo_fence`
- **Data hygiene:** `pii_redaction` ✓, `injection_guard` ✓
- **Kill switches:** `write_freeze` ✓, destructive-tool-tagging
- **Idempotency / dedupe:** `idempotency_required`

- [ ] **G.13** (M) `geo_fence` builtin — data residency policy. Config `{allowed_regions: string[], source: 'header'|'org_setting'}`. Pre-call check of `x-agent-region` header or org's configured region against allowlist. EU AI Act Aug 2026 enforcement relevance.
- [ ] **G.14** (M) `agent_identity_required` builtin — reject calls missing a signed `x-agent-id` / `x-user-on-behalf-of` header. Config `{require_headers: string[], verify_signature: boolean, trust_chain_id?: string}`. Meta confused-deputy incident is the anchor. Pairs with the client_id policy for layered identity.
- [ ] **G.15** (M) `idempotency_required` builtin — dedupe destructive side-effect calls inside a TTL window. Config `{ttl_seconds: number, key_source: 'header'|'args_hash'}`. Needs a TTL store (in-memory Map with cleanup OR Redis in V2); single-process Map is fine for demo. Reject duplicates within window, return "deduped: true" audit tag.
- [ ] **G.16** (S, hygiene) Env-driven Anthropic model IDs. `lib/config/models.ts` with `modelPlayground()` + `modelEvaluateGoal()` reading from `PLAYGROUND_MODEL` + `EVALUATE_GOAL_MODEL`, fail loud if unset. Update `app/api/playground/run/route.ts` + `lib/mcp/evaluate-goal.ts` + `.env.example`. Codifies "no hardcoded model IDs in production code" as a review rule.
- [ ] **G.3** (L) Route designer UI — React Flow step editor + rollback/fallback wiring. ← B.2, G.2
- [ ] **G.7** (M) Per-server detail: violation counts + copy-ready MCP client config block + resources/prompts introspect. ← D.1, F.4
- [ ] **G.8** (S) Graph: domain-boundaries toggle + per-server policy count badge. ← B.1

### H. Monitoring + overview
- [ ] **H.1** (M) Monitoring page — 3 lean widgets: call volume, policy violations over time, PII detections by pattern.
- [ ] **H.2** (S) Overview dashboard domain filter. ← B.1

### I. Opus 4.7 showcase + visual beats
- [ ] **I.1** (M) **P0 stretch** — Extended-thinking blocks live-rendered in demo agent panel. SSE stream of thinking events → collapsible "Show reasoning" toggle. ← J.1
- [ ] **I.3** (L) **P1 stretch** — Opus relationship inference on OpenAPI import (1M-context showcase). On import, feed full spec to Opus 4.7 with cached system prompt; user approves/rejects proposals in dashboard before persist; thinking blocks surface reasoning. ← C.1
- [ ] **I.4** (M) **P1 stretch** — Shadow → enforce timeline (7-day would-have-blocked trail per policy). ← B.4, G.4
- [ ] **I.5** (M) **P1 stretch, Thu decision** — Managed Agents wrap for demo agent ($5K side prize). Port demo-agent loop from `@anthropic-ai/sdk` manual loop → Managed Agents API; point at deployed `/api/mcp`; wire extended thinking into embedded agent UI; keep SDK version as fallback. **Apply only to the demo agent, never to the product gateway.** ← J.1
- [ ] **I.6** (L) **P1 Fri stretch** — Playground "Refine with Opus" button backed by Managed Agents. After a Playground run completes, a new button ingests: scenario prompt, both panes' tool-call traces, policy events fired, and the gateway's relationship manifest. Managed Agent returns structured suggestions rendered as expandable cards, e.g. "policy `redact_contact_pii` in shadow caught a leak at step 2 — flip to enforce", "add `produces_input_for` edge from `search_issues` → `create_issue` to avoid duplicates", "tighten `allowlist_task_subjects` — observed subject `\"Follow up\"` is near the pattern limit". Reinforces the product framing: Playground = OOTB eval surface on our bill, Managed Agents = refinement-as-a-service. Natural $5K Managed Agents side-prize landing + demo narrative. ← J.1, I.5 (shares Managed Agents setup)

### J. Demo + verification
- [ ] **J.2** (M) End-to-end verification against Vercel (opt-in Anthropic vitest extended to Playground Route). ← J.1

---

## [P1 post-sprint-5] Sprint 5 follow-up hardening
Reviewer-flagged items from Sprint 5 Day 2. None gate the demo; all improve robustness. Pull when there's slack or when RLS re-enablement happens V2.

- [ ] `lib/manifest/cache.ts:146` — `fetchOrgManifest` pulls every `route_steps` row (no filter). Align with `fetchDomainManifest`: compute `routeIds` from fetched routes then `.in('route_id', routeIds)` conditional on non-empty. Closes a would-be cross-tenant leak at V2.
- [ ] `lib/policies/built-in.ts` — `runIpAllowlist` IPv4-only; IPv6 clients silently denied. Add IPv6 CIDR matcher + fix the misleading comment at lines 166-169.
- [ ] `lib/manifest/cache.ts` — extract `fetchByIds<T>(supabase, table, column, ids)` helper; `fetchOrgManifest` (54 lines) and `fetchDomainManifest` (72 lines) exceed 50-line convention.
- [ ] `app/api/mcp/domain/[slug]/route.ts` + `app/api/mcp/server/[id]/route.ts` — add Zod `safeParse` on `slug` / `id` route params; returns clean 400 instead of Postgres UUID-format error.
- [ ] `lib/mcp/gateway-handler.ts:30-41` — `x-forwarded-for` trusted unconditionally. Safe on Vercel (platform rewrites it) but spoofable on non-Vercel deploys. Add `TRUSTED_PROXY_ENABLED` env flag before any self-hosted deploy.
- [ ] `lib/mcp/stateless-server.ts` — `createStatelessServer` at 180 lines, each request handler block (`ListTools`, `CallTool`, `DiscoverRelationships`, `FindWorkflowPath`) extractable to module-level functions.
- [ ] `lib/policies/enforce.ts:80,84,86` — `as ClientIdConfig` / `as IpAllowlistConfig` / `as AllowlistConfig` casts inherit pre-existing `as Config` pattern without validating what the DB stored. Add per-`builtin_key` Zod schemas inside `evaluatePreCall`.

---

## P2 stretch — Opus 4.7 showcase garnishes

### [P2 stretch] Natural-language policy author
User types "block PII on external domains after 6pm" → Opus translates to structured config matching one of the 7 builtin policy schemas. Clean Opus beat, nice demo garnish. Distinct from the larger "Custom policy DSL" item below — this uses existing builtin schemas rather than defining a new grammar.

- [ ] Textarea in policy editor with "Ask Opus" button
- [ ] Returns JSON matching one of the 7 built-in schemas
- [ ] User reviews before save

---

## P1/P2 — Polish + robustness

### [P1] Rediscover-tools button on each server card
Direct-MCP imports run `tools/list` once at register time. If the upstream MCP server adds/removes tools later, our copy goes stale. Add a per-server action that re-runs `discoverTools()` and diffs against the current `tools` table (insert new, delete missing, update changed `description`/`input_schema`).

- [ ] `POST /api/servers/:id/rediscover` → decrypt auth_config, call discoverTools, diff + upsert
- [ ] Button on ServerCard → calls endpoint → toast with tool delta
- [ ] `invalidateManifest()` after upsert

### [P1] Real event aggregation for the Overview traffic chart
`components/chart-area-interactive.tsx` ships with 90 days of Apr–Jun 2024 fixture data. Replace with a server-side aggregation of `mcp_events` bucketed by day, split by `status === 'ok'` (calls) vs `blocked_by_policy` (blocked). Postgres view or `date_trunc('day', created_at)` group-by.

- [ ] `/api/gateway-traffic?range=7d|30d|90d` returning `[{date, calls, blocked}]`
- [ ] Chart consumes real data; keep fixture as fallback when DB empty
- [ ] Move demo fixture to `lib/fixtures/gateway-traffic.ts` to trim the component

### [P1] Replace audit 1s polling with Supabase realtime
`app/dashboard/audit/page.tsx` uses `setInterval(1000)`. Wasteful and forces the `react-hooks/set-state-in-effect` eslint-disable. Swap to `supabase.channel('mcp_events').on('postgres_changes', ...)` so events push only when rows arrive.

- [ ] Realtime subscription with polling fallback if subscribe fails
- [ ] Remove the effect eslint-disable once migrated

### [P2] Periodic MCP tool re-discovery (cron)
Sibling of the manual rediscover button. Nightly cron that re-discovers + diffs all registered MCP servers. Supabase scheduled functions or Vercel cron. Out of scope for single-user demo; matters when users register third-party MCP servers and expect the manifest to stay fresh.

### [P2] Zod-validate MCP gateway responses in graph page
`app/dashboard/graph/page.tsx:100` parses `/api/mcp` JSON-RPC body with `as { result?: TrelResponse; ... }` — no runtime check. Gateway is our own code so risk is low, but it violates the CLAUDE.md boundary-validation rule. Add a Zod schema next to `TrelResponse` and `.safeParse()` before consuming.

### [P2] SSE multi-event parser for MCP gateway responses
`lib/mcp/discover-tools.ts` and the graph page both regex `text.match(/data:\s*(\{[\s\S]*?\})/)` to pull a single SSE event. Fine today (one event per response); breaks the instant the gateway streams progressive responses, keepalive frames, or cancellation. Replace with a proper SSE line parser iterating over `data:` events.

### [P2] Strip internal error text from API responses
Several routes bubble Supabase error messages through a `details` field (e.g. `{ error: "update failed", details: err.message }`). Matches CLAUDE.md "never expose internal error details" prohibition. Keep detail going to server logs, return only stable error codes to clients.

- [ ] Replace `details: err.message` with `console.error(...)` + opaque `error_code` in the response body across `/api/servers`, `/api/openapi-import`, `/api/policies*`

### [P2] Harden SSRF guard against DNS-rebinding
`lib/security/ssrf-guard.ts` validates DNS on entry but `fetchWithTimeout` re-resolves on the actual request — a malicious authoritative server can return a public IP first (passes the check) and a private IP on the hot fetch. Acceptable for hackathon scope (guard still blocks the obvious attacks) but the canonical fix is to pin the pre-validated IP into a custom `undici.Agent` with a fixed `lookup` function so the request hits the exact address we verified. Pull in when we wire real third-party MCP server imports.

### [P2] ReDoS guard on policy config regex
`lib/policies/built-in.ts::compilePatterns` does `new RegExp(config.patterns[].regex, 'gi')` with no validation — a malicious or sloppy policy config can slip in catastrophic backtracking (`(a+)+$` etc.). Acceptable in single-user MVP. Before multi-tenancy, validate with `safe-regex` or wrap each `runPiiRedaction` scan in a `setTimeout`-based fuse that aborts long matches.

- [ ] Pre-validate user regex on write (`/api/policies` POST/PATCH) with a `safe-regex` check
- [ ] Or: runtime fuse — wrap each scan in a fuse that rejects beyond N ms

---

## P2 — Repo + UX polish

### [P2] GitHub repo metadata polish — check before demo
Repo topics + license + branch protection done in Sprint 1. Remaining polish for submission credibility.

- [ ] Repo About section — short description ("MCP control plane for agentic workflows — hackathon build") + website URL (Vercel deploy)
- [ ] Social preview image — 1280×640 og-image so link unfurls look professional on X / Slack / Discord
- [ ] Verify `LICENSE` renders correctly on GitHub (should show the license type in the About panel)
- [ ] Verify repo description + topics still match final scope after build

### [P2] Cosmetic cleanup
- [ ] `components/ui/button.tsx` — shadcn ships without semicolons; our `.prettierrc` wants them. Run `pnpm exec prettier --write components/ui` to normalize next time it's touched.

### [P2] Split large shadcn primitives if they get hand-edited
`components/ui/sidebar.tsx` (727 lines) and `components/data-table.tsx` (618 lines) exceed the 400-line convention. Vendored shadcn output — splitting breaks the CLI update model. Trigger a split the moment we add project-specific logic beyond trivial adaptation.

### [P2] Sidebar nav badges (counts per section)
Nav items in `components/app-sidebar.tsx` are label-only. Show a count badge next to Servers (tool count), Policies (active count), Audit (events-last-hour) so the sidebar is a glanceable status bar. Requires a shared stats fetcher (Server Component wrapper or context). Low priority — Overview already shows the counts.

### [P2] policy-row micro-fixes
Flagged by the code reviewer on WP-3.5 commit.

- [ ] `components/dashboard/policy-row.tsx:192` — `className="... border border ..."` duplicate utility, remove one
- [ ] `components/dashboard/policy-row.tsx:44` — `new Map(assignments)` rebuilt each render; wrap in `useMemo` if assignment count grows past ~20

### [P2] Replace `export default` in Next.js pages/layouts with named exports
Next.js framework contract requires default exports for `page.tsx` / `layout.tsx` / `route.ts` handlers, so our "named exports only" convention has a built-in carve-out. Document the carve-out in `CLAUDE.md` to stop code reviewers flagging it, or migrate to a wrapper pattern (named export + `export default wrapped`).

---

## Vision gaps from reference architecture (`/projects/semantic-gps/docs`)
Discovered 2026-04-22 when auditing the reference monorepo's `Architecture.md` + `Business Concept.md` against our build. The reference is a 2-person-year roadmap; the hackathon demo only needs the wedge. Parking the full-vision pieces here so nothing gets lost.

### [P2 stretch] Navigation Bundle compile + offline routing
Reference ships "Navigation Bundles": encrypted compiled graph + policies the data plane downloads so it can route without a live control-plane connection. Pure operational feature — zero demo value for judging but enormous for real enterprise sell.

- [ ] Bundle schema: graph + policies + semantic defs, signed + gzipped
- [ ] `POST /api/bundles/compile` emits bundle for a domain
- [ ] Gateway can boot from a bundle file (not just DB)

### [P2 stretch] A2A (Agent-to-Agent) protocol bridge
Reference exposes Routes as both MCP endpoints AND A2A endpoints so multi-agent systems can collaborate through the gateway. MCP is v1; A2A is v2+.

- [ ] A2A card schema + registry
- [ ] Route → A2A card transform
- [ ] Inbound A2A dispatch to Route execution

### [P2 stretch] Simulation Playground / LLM Evaluator
Reference "Simulation Playground" — sandbox that runs a test Agent against a Route and scores whether it can navigate successfully before deploying. Great for demoing but adds a whole sub-product.

- [ ] Harness that runs a scripted agent against a Route with recorded transcripts
- [ ] Pass/fail heuristics: tool-call count, policy violations, goal match
- [ ] Dashboard UI showing per-Route evaluation scores

### [P2] OpenTelemetry distributed tracing
Reference data plane emits OTel traces per Route step. Our `trace_id` in `mcp_events` is good enough for demo; OTel matters when this deploys against real observability stacks (Honeycomb, Datadog).

- [ ] `@opentelemetry/api` + OTLP exporter wiring
- [ ] Span per `execute_route` step, linked to parent trace
- [ ] Env var to point at collector

### [P2] Agent Card Designer — A2A card rewriting
Reference "Agent Card Designer" templating engine — rewrites how tools are presented to agents beyond simple rename (adds examples, preferred patterns, narrative guidance). Sprint 6's semantic-rewriting layer (WP-G.6) handles tool-name aliases; this is the richer version.

- [ ] `agent_card_templates` table — jsonb template per tool/route
- [ ] Render agent cards on `tools/list` with template substitution
- [ ] Dashboard WYSIWYG editor for the template

### [P2 stretch] Semantic Definition Store (universal business meaning)
Reference separates "Meaning" (what a Lead IS) from the underlying API (how Salesforce represents a Lead). Every tool referencing `Lead` pulls from the same definition — the Semantic Map. Huge surface, parked for post-hackathon.

- [ ] `semantic_entities` table — entity name + schema + description
- [ ] Tool input/output schemas reference semantic entities instead of inlining
- [ ] Dashboard to author + version entities

### [P2] Semantic caching on the gateway
Reference "Semantic Router" caches not just data but routing decisions (e.g., "goal X = Route Y") so repeated semantic queries skip re-resolution. Layer on top of the manifest cache, keyed on normalized goal strings.

- [ ] LRU cache keyed on `hash(goal + manifest_version)`
- [ ] Invalidate on relationship/route mutation
- [ ] Telemetry on hit-rate

### [P2 stretch] First-class Rollback Routes
Sprint 5 lands per-step `rollback_tool_id` on `route_steps`. Reference treats Rollback Routes as first-class entities — named, reusable, composable chains (e.g., "undo_lead_conversion" rolls back 3 different tools in reverse). Pull in after MVP if users want reusable rollback flows.

- [ ] `rollback_routes` table referencing an ordered list of compensating tool calls
- [ ] `route_steps.rollback_route_id` replaces (or augments) `rollback_tool_id`
- [ ] Rollback UI in Route designer

### [P2] Rust data plane
Reference's terminal vision has the gateway as a Rust binary for throughput + edge deploy. Our Next.js gateway is good enough for demo and for a hosted SaaS launch; Rust matters when enterprises want self-hosted at scale.

- [ ] Port stateless-server + policy engine + audit logger to Rust
- [ ] Wasm or native distribution; same `/api/mcp` contract
- [ ] Control plane stays Next.js, data plane stays Rust

---

## V2 cuts from USER-STORIES.md
These stories appeared in `docs/USER-STORIES.md` but are out of Sprint-4 scope. Each is tagged V2 in the stories doc too.

### [P1 post-hackathon] Email verification + rate-limit on auth endpoints
Supabase supports both out of the box; deferred for Sprint 4 to stay focused on hero demo.

- [ ] Email verify flow + page
- [ ] Rate-limit on `/api/auth/login`, `/signup`, `/forgot-password` (edge middleware or Supabase-native)

### [P0 Fri conditional] Real multi-tenancy — RLS + invite flow
**CONDITIONAL PULL RULE:** only initiate if (a) all Sprint 8 WPs closed by Thu EOD, AND (b) full Friday available (no other commitments, no Sprint 8 slippage). Decide 9am Fri — if either condition false, DO NOT START. Half-baked multi-org is worse than clean single-admin MVP; RLS bugs can silently empty the whole dashboard 24h before submission.

**Why this is compelling for judging:**
- Differentiator from Agentforce positioning — "multi-user agent control plane" is a harder pitch to match
- 10-sec invite-teammate beat in the demo video amplifies the governance story
- Tells the Opus 4.7 Use story better (agents operating on behalf of real multi-user orgs)

**Scope (locked if pulled, L-sized, ~6-8h):**

1. RLS migration — enable + policies
   - [ ] `supabase/migrations/20260425100000_rls_multi_tenant.sql`
   - Enable RLS on: `organizations`, `memberships`, `domains`, `servers`, `tools`, `relationships`, `policies`, `policy_assignments`, `policy_versions`, `routes`, `route_steps`, `gateway_tokens`, `mcp_events`
   - Policy pattern: `using (organization_id in (select organization_id from memberships where user_id = auth.uid()))` — cached via SECURITY DEFINER helper `public.current_user_orgs()` to avoid N+1 on every query
   - SECURITY DEFINER RPC for the MCP gateway service-role path (bypasses RLS for cross-org manifest lookups by server_id)

2. Signup trigger refactor
   - [ ] Skip auto-workspace when an invite code is present in `auth.users.raw_user_meta_data` (`{invite_code: "..."}`)
   - [ ] Accept the invite: attach membership to the inviting org, don't create a new org

3. Invite flow
   - [ ] `public.invites` table (id, organization_id, email?, token_hash, expires_at, accepted_at, created_by)
   - [ ] `POST /api/invites` — generate invite; returns signed link `https://.../invite?token=<jwt>` where JWT payload = `{invite_id, org_id}` signed with `CREDENTIALS_ENCRYPTION_KEY` variant
   - [ ] `/invite?token=...` — landing page, shows "Join <Org Name>", redirects to `/signup?invite=<token>` or `/login?invite=<token>` (existing user)
   - [ ] On signup with `?invite=<token>`: pass into `raw_user_meta_data` so trigger picks it up
   - [ ] On login with `?invite=<token>`: add membership to the inviting org, redirect to `/dashboard`

4. Settings UI (minimal)
   - [ ] `/dashboard/settings` page — Org Members section: list members (email + role + joined-at), "Copy invite link" button, "Remove member" (only self or admin-of-org)
   - [ ] Role enum widen: `admin | member` (keep viewer for V2; 2 roles is enough for demo)

5. Migrate existing data
   - [ ] One-shot SQL via Supabase MCP: audit all existing rows' `organization_id` values; every row must belong to a live org (Demo Org in our case)
   - [ ] Revoke any lingering broken FKs

6. Verification
   - [ ] Opt-in vitest (`VERIFY_RLS=1`) that spins up 2 auth users in 2 orgs, asserts cross-org queries return empty
   - [ ] Manual smoke: sign up new user, invite them, they join, they see the same servers — record a 10-sec clip for the demo

**Cut lines (do NOT pull even if time):**
- Multiple roles beyond admin/member (viewer, owner-transfer, per-tool permissions)
- SSO / SCIM
- Org switching UI (user in multiple orgs) — force single-membership for demo
- Remove-member cascade review (what happens to tokens they minted? — park for V2)

**Failure mode:** if 4pm Fri hits and RLS is causing dashboard to go empty, REVERT the RLS migration and ship the single-admin MVP. Don't sink the recording window trying to fix multi-tenant in the last 2 hours.

### [P1 post-hackathon] Signup onboarding: skip auto-workspace when Demo Org exists
Currently the `on_auth_user_created` trigger ALWAYS creates a fresh `<handle>'s Workspace` for every signup. For demo/onboarding flows where a single shared Demo Org should be the landing pad, this creates 2 problems: (1) user lands in an empty workspace and can't see seeded MCPs, (2) reparenting them to Demo Org requires deleting the auto-workspace, which cascade-nukes any tokens they minted in it.

Options:
- [ ] Config flag on the trigger: if `SEMANTIC_GPS_SINGLE_ORG_MODE=1` env (or a settings table row), skip org creation and just add membership to the existing first-created org
- [ ] OR: at dashboard level, detect orphan auto-workspace vs shared Demo Org and prompt the user to "Join Demo Org" with data migration done atomically server-side
- [ ] Fix the cascade footgun: `gateway_tokens.organization_id` uses ON DELETE CASCADE; rethink for workspace-consolidation scenarios

### [P1 post-hackathon] Role promotion + member removal + invite flow
Single-admin MVP in Sprint 4 (first signup = admin of their own org). Multi-user org needs RLS re-enablement + role expansion + invite flow (email + unique link).

- [ ] `memberships.role` enum expanded beyond `admin`
- [ ] RLS re-enabled on all application tables with `auth.uid()` checks
- [ ] Promote / demote UI in Settings > Organization
- [ ] Remove-member flow
- [ ] Invite via email + unique link

### [P2] Email address change
Dashboard Settings > Profile lets users change their login email. Supabase supports via `updateUser({ email })` with re-verification. Trivial when signup flow ships.

- [ ] Settings > Profile — change-email with re-verification

### [P2] Custom policy DSL
Sprint 4 ships 7 built-in policies (PII, rate_limit, allowlist, injection_guard, basic_auth, client_id, ip_allowlist) which cover the demo. A custom policy DSL is a 2-day product on its own — parser, evaluator, editor, versioning schema, security review. Post-hackathon. See also the narrower "Natural-language policy author" above which uses existing builtin schemas rather than a new grammar.

- [ ] DSL grammar (EBNF)
- [ ] Parser + AST evaluator
- [ ] Policy editor with syntax highlight
- [ ] `/api/policies/translate` NL→DSL (requires DSL to exist)

### [P2] Workflow Evaluator benchmark harness (keyword / semantic / hybrid matching)
Original USER-STORIES.md story was a benchmark that compares which matching strategy best surfaces the right tool for a goal. Sprint 4 pivots this into the **Playground A/B demo** (J.1) instead — richer narrative, less engineering surface. The strategy-comparison harness itself is a standalone eval product.

- [ ] Keyword + embedding + hybrid scoring implementations
- [ ] Golden-set of goal→tool pairs
- [ ] Score board UI comparing strategies

### [P2] Monitoring widget customization
Sprint 4 ships 3 lean widgets fixed. Drag-to-resize, pick-your-widgets is a V2 polish.

- [ ] `user_dashboard_layouts` table
- [ ] Widget registry with per-widget config
- [ ] Drag/resize UI

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
