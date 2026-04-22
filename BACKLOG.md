# claude-hackathon - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

## [P0 Sat AM] Record fallback demo clip — CANNOT SLIP
Hero scenario (Live Policy Swap w/ PII redaction) recorded 5 takes minimum on Saturday morning using the deployed Vercel URL. Mirror-upload to YouTube (unlisted) + Loom + Google Drive. Saturday recording IS the submission video — Sunday is for summary + upload only, not for debugging.

- [ ] Record hero scenario (~75s) + OpenAPI import (~45s) + workflow graph (~30s) + intro/outro (~30s) = 3 min
- [ ] Cut in iMovie / DaVinci, scripted voiceover, no "um"s
- [ ] Upload to YouTube unlisted + Loom + Drive; paste all 3 URLs into `docs/SUBMISSION.md`

## [P0 Sat PM] README + submission summary
Replaces CNA boilerplate. **Required for submission.**

- [ ] `README.md` — one-paragraph pitch, quickstart (`supabase start` → `.env.local` → `pnpm dev`), env table, Vercel link, demo video embed
- [ ] `docs/SUBMISSION.md` — 100–200 word written summary for CV platform

## [P0 Sat] Replace CNA landing
CNA branding leaks into `app/layout.tsx` tab title + `app/page.tsx` marketing shell. Fix before recording.

- [ ] `app/layout.tsx` — replace metadata (`title: "Create Next App"`, description)
- [ ] `app/page.tsx` — thin Semantic GPS landing with "Open Dashboard" CTA (or direct redirect to `/dashboard`)

## [P0 daily-pull] Sprint 4+ queue — 30 WPs remaining (dep-annotated)
Originally planned as a 42-WP mega-sprint. Collapsed to daily-sprint cadence 2026-04-22 (CLAUDE.md sweet spot = 3-6 WPs/sprint). Shipped: Sprint 4 Day 1 (A.1, B.1, B.3, B.4, C.1, C.2). Currently in flight: Sprint 5 Thu (A.2, B.2, C.3, C.5, D.1, G.5). Fri/Sat pulls come from here. Dep convention: `← blocked by X` / `→ blocks Y`. Sizes: S <1h, M 1-3h, L >3h. Pull rule: morning picks WPs whose `← blocked by` edges all landed.

**Projected judge card (all P0 landing):** Impact 9 · Demo 9 · Opus 4.7 Use 8 · Depth 9 → ~87% weighted.

**Critical path:** `A.1 → B.1 → D.1 → E.* → F.1 → J.1 → record`. Everything else parallelizes.

### A. Platform — Auth + Org + Settings
- [ ] **A.3** (S) Password reset flow (request + submit). ← A.2
- [ ] **A.4** (S) Real auth middleware on `proxy.ts`; remove dev-login bypass. ← A.2 → D.2, J.2
- [ ] **A.5** (S) Settings page — username + org name edit. ← A.1, A.2

### C. Real proxy layer
- [ ] **C.4** (M) Multi-origin per server + health-driven origin swap. ← C.3, F.4 → F.2

### D. Three-tier gateway routing + auth
- [ ] **D.2** (M) Gateway auth header verification — reject unauthenticated calls before any tool; per-endpoint token scheme. ← A.4 → J.1, J.2

### E. Real integrations
- [ ] **E.1** (M) Salesforce via `jsforce` username-password + curated 5 tools (find_account, find_contact, get_opportunity, update_opportunity_stage, create_task). ← C.3, B.1 → F.1 e2e, J.1, J.3
- [ ] **E.2** (M) Slack hand-authored OpenAPI subset (`chat.postMessage`, `users.lookupByEmail`, `conversations.list`) + Bot Token. ← C.3, B.1 → J.1, J.3
- [ ] **E.3** (M) GitHub — register official MCP server via HTTP-Streamable direct-MCP federation; PAT auth. ← C.3, B.1 → J.1, J.3

### F. Routes + stateful orchestration
- [ ] **F.1** (L) `execute_route` MCP method — sequential steps, output threading via `output_capture_key` → next-step `input_mapping`, per-step policy stack, chained `trace_id`. ← B.2, C.3, E.* → F.2, F.3, G.1, J.1
- [ ] **F.2** (M) Fallback execution — follows `fallback_to` edges + multi-origin swap; emits `fallback_triggered`. ← F.1, B.3, C.4 → I.2
- [ ] **F.3** (M) Rollback execution — uses `compensated_by` edges, reverse-order compensation; emits `rollback_executed`. ← F.1, B.3 → I.2
- [ ] **F.4** (S) Origin health probes (`/api/health/:server_id`, cached flag). ← B.1 → C.4, G.7

### G. TRel completion + policies + authoring UI
- [ ] **G.1** (M) `validate_workflow` + `evaluate_goal` TRel methods (real impls, not stubs). ← B.2 → J.1
- [ ] **G.2** (M) Relationship CRUD API + dashboard UI (add/edit/delete typed edges with descriptions). ← B.3 → G.3
- [ ] **G.3** (L) Route designer UI — React Flow step editor + rollback/fallback wiring. ← B.2, G.2
- [ ] **G.4** (M) Rate-limit + injection-guard policies + config UI (replaces JSON textarea) + `policy_versions` writes. ← B.4 → I.4
- [ ] **G.6** (S) Semantic rewriting layer — `tools.display_name` + `display_description`; gateway publishes display values, proxies by origin name. ← C.3
- [ ] **G.7** (M) Per-server detail: violation counts + copy-ready MCP client config block + resources/prompts introspect. ← D.1, F.4
- [ ] **G.8** (S) Graph: domain-boundaries toggle + per-server policy count badge. ← B.1

### H. Monitoring + overview
- [ ] **H.1** (M) Monitoring page — 3 lean widgets: call volume, policy violations over time, PII detections by pattern.
- [ ] **H.2** (S) Overview dashboard domain filter. ← B.1

### I. Opus 4.7 showcase + visual beats
- [ ] **I.1** (M) **P0** — Extended-thinking blocks live-rendered in demo agent panel. ← J.1. (Supersedes the `[P2 stretch] Extended thinking side panel` entry below for Sprint-4 purposes.)
- [ ] **I.2** (M) **P0** — Rollback cascade visualization (reverse-step lights up on route failure). ← F.3
- [ ] **I.3** (L) **P1 stretch** — Opus relationship inference on OpenAPI import (1M-context showcase). ← C.1. (See `[P2 stretch] Opus-powered relationship inference on OpenAPI import` below for full detail.)
- [ ] **I.4** (M) **P1 stretch** — Shadow → enforce timeline (7-day would-have-blocked trail per policy). ← B.4, G.4
- [ ] **I.5** (S) **P1 stretch, Thu decision** — Managed Agents wrap for demo agent ($5K side prize). ← J.1. (See `[P1 Fri–Sat] Managed Agents wrap` below.)

### J. Demo + verification
- [ ] **J.1** (L) **Playground A/B hero** — `/dashboard/playground` with two panes: left = Opus 4.7 + raw SF/Slack/GitHub MCPs; right = Opus 4.7 + `/api/mcp/domain/salesops`. Same scenario button drives both. Mid-demo PII enforce toggle on right pane. Diff view: tool calls, latency, policy events, errors. ← D.1, D.2, E.*, F.1, G.1 → I.1, I.5, J.2, J.3
- [ ] **J.2** (M) End-to-end verification against Vercel (opt-in Anthropic vitest extended to Playground Route). ← J.1, A.4
- [ ] **J.3** (S) Real demo seed — domain + 1 Route + 8 relationships + policies referencing REAL tool IDs from E.*. ← E.*, G.2

### Risks
- D.2 gateway auth cannot ship before A.4; J.2 E2E depends on both.
- E.1 Salesforce username-password requires a Dev-Edition with API access — confirm creds before Fri.
- J.1 Playground is L-size with 5 cross-stream deps → highest slip risk; pull no later than Sat AM.

## [P1 post-sprint-5] Sprint 5 follow-up hardening
Reviewer-flagged items from Sprint 5 Day 2. None gate the demo; all improve robustness. Pull when there's slack or when RLS re-enablement happens V2.

- [ ] `lib/manifest/cache.ts:146` — `fetchOrgManifest` pulls every `route_steps` row (no filter). Align with `fetchDomainManifest`: compute `routeIds` from fetched routes then `.in('route_id', routeIds)` conditional on non-empty. Closes a would-be cross-tenant leak at V2.
- [ ] `lib/policies/built-in.ts` — `runIpAllowlist` IPv4-only; IPv6 clients silently denied. Add IPv6 CIDR matcher + fix the misleading comment at lines 166-169.
- [ ] `lib/manifest/cache.ts` — extract `fetchByIds<T>(supabase, table, column, ids)` helper; `fetchOrgManifest` (54 lines) and `fetchDomainManifest` (72 lines) exceed 50-line convention.
- [ ] `app/api/mcp/domain/[slug]/route.ts` + `app/api/mcp/server/[id]/route.ts` — add Zod `safeParse` on `slug` / `id` route params; returns clean 400 instead of Postgres UUID-format error.
- [ ] `lib/mcp/gateway-handler.ts:30-41` — `x-forwarded-for` trusted unconditionally. Safe on Vercel (platform rewrites it) but spoofable on non-Vercel deploys. Add `TRUSTED_PROXY_ENABLED` env flag before any self-hosted deploy.
- [ ] `lib/mcp/stateless-server.ts` — `createStatelessServer` at 180 lines, each request handler block (`ListTools`, `CallTool`, `DiscoverRelationships`, `FindWorkflowPath`) extractable to module-level functions.
- [ ] `lib/policies/enforce.ts:80,84,86` — `as ClientIdConfig` / `as IpAllowlistConfig` / `as AllowlistConfig` casts inherit pre-existing `as Config` pattern without validating what the DB stored. Add per-`builtin_key` Zod schemas inside `evaluatePreCall`.

## [P1 Fri–Sat] Managed Agents wrap for demo agent ($5K side prize)
**Conditional on Thursday decision gate.** Default: cut. Reconsider only if Michael Cohen's Thu 11am session reveals <2h migration cost on top of the raw SDK demo agent (WP-3.6). Apply only to the demo agent, never to the product gateway.

- [ ] Port demo-agent loop from `@anthropic-ai/sdk` manual loop → Claude Managed Agents API call
- [ ] Point at deployed `/api/mcp` endpoint as tool surface
- [ ] Wire extended thinking blocks into the embedded agent UI panel
- [ ] Keep raw SDK version maintained as fallback (don't delete)

## [P2 stretch] Opus-powered relationship inference on OpenAPI import
On import, Opus 4.7 reads full OpenAPI spec (long-context play) and proposes the initial relationship graph by reasoning about endpoint dependencies. Big Opus-showcase feature. Adds ~4h to import flow.

- [ ] Post-import step: feed full spec to Opus with cached system prompt, ask for relationship proposals
- [ ] User approves/rejects in dashboard before persistence
- [ ] Surface thinking blocks so judges see the reasoning

## [P2 stretch] Natural-language policy author
User types "block PII on external domains after 6pm" → Opus translates to structured policy config. Clean Opus beat, nice demo garnish.

- [ ] Textarea in policy editor with "Ask Opus" button
- [ ] Returns JSON matching one of the 2 built-in schemas
- [ ] User reviews before save

## [P2 stretch] Extended thinking side panel in demo agent
Live-render Opus thinking blocks in the embedded agent UI. Heavily scored under Opus 4.7 Use but adds ~4h of streaming UI.

- [ ] SSE stream of thinking events from demo agent to panel component
- [ ] Collapsible "Show reasoning" toggle

## [P2] GitHub repo metadata polish — check before demo
Repo topics + license + branch protection done in Sprint 1. Remaining polish for submission credibility.

- [ ] Repo About section — short description ("MCP control plane for agentic workflows — hackathon build") + website URL (Vercel deploy)
- [ ] Social preview image — 1280×640 og-image so link unfurls look professional on X / Slack / Discord
- [ ] Verify `LICENSE` renders correctly on GitHub (should show the license type in the About panel)
- [ ] Verify repo description + topics still match final scope after build

## [P2] Cosmetic cleanup
- [ ] `components/ui/button.tsx` — shadcn ships without semicolons; our `.prettierrc` wants them. Run `pnpm exec prettier --write components/ui` to normalize next time it's touched.

## [P2] Wire GitHub status check for branch protection
Branch protection on `main` expects a status check named `"Lint · Type-check · Test"` that isn't configured — every push logs a "Bypassed rule violations" line. Set up a GitHub Actions workflow running `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` so pushes are actually gated. Low-priority because the local pre-commit hook already blocks bad commits.

- [ ] `.github/workflows/ci.yml` — node 22 + pnpm, cache `~/.pnpm-store`, run the 3 gates
- [ ] Confirm branch-protection status-check name matches the workflow's job name

## [P2] ReDoS guard on policy config regex
`lib/policies/built-in.ts::compilePatterns` does `new RegExp(config.patterns[].regex, 'gi')` with no validation — a malicious or sloppy policy config can slip in catastrophic backtracking (`(a+)+$` etc.). Acceptable in single-user MVP. Before multi-tenancy, validate with `safe-regex` or wrap each `runPiiRedaction` scan in a `setTimeout`-based fuse that aborts long matches.

- [ ] Pre-validate user regex on write (`/api/policies` POST/PATCH) with a `safe-regex` check
- [ ] Or: runtime fuse — wrap each scan in a fuse that rejects beyond N ms

## [P2] Strip internal error text from API responses
Several routes bubble Supabase error messages through a `details` field (e.g. `{ error: "update failed", details: err.message }`). Matches CLAUDE.md "never expose internal error details" prohibition. Keep detail going to server logs, return only stable error codes to clients.

- [ ] Replace `details: err.message` with `console.error(...)` + opaque `error_code` in the response body across `/api/servers`, `/api/openapi-import`, `/api/policies*`

## [P2] Harden SSRF guard against DNS-rebinding
`lib/security/ssrf-guard.ts` validates DNS on entry but `fetchWithTimeout` re-resolves on the actual request — a malicious authoritative server can return a public IP first (passes the check) and a private IP on the hot fetch. Acceptable for hackathon scope (guard still blocks the obvious attacks) but the canonical fix is to pin the pre-validated IP into a custom `undici.Agent` with a fixed `lookup` function so the request hits the exact address we verified. Pull in when we wire real third-party MCP server imports.

## [P1] Rediscover-tools button on each server card
Direct-MCP imports run `tools/list` once at register time. If the upstream MCP server adds/removes tools later, our copy goes stale. Add a per-server action that re-runs `discoverTools()` and diffs against the current `tools` table (insert new, delete missing, update changed `description`/`input_schema`).

- [ ] `POST /api/servers/:id/rediscover` → decrypt auth_config, call discoverTools, diff + upsert
- [ ] Button on ServerCard → calls endpoint → toast with tool delta
- [ ] `invalidateManifest()` after upsert

## [P1] Real event aggregation for the Overview traffic chart
`components/chart-area-interactive.tsx` ships with 90 days of Apr–Jun 2024 fixture data. Replace with a server-side aggregation of `mcp_events` bucketed by day, split by `status === 'ok'` (calls) vs `blocked_by_policy` (blocked). Postgres view or `date_trunc('day', created_at)` group-by.

- [ ] `/api/gateway-traffic?range=7d|30d|90d` returning `[{date, calls, blocked}]`
- [ ] Chart consumes real data; keep fixture as fallback when DB empty
- [ ] Move demo fixture to `lib/fixtures/gateway-traffic.ts` to trim the component

## [P1] Replace audit 1s polling with Supabase realtime
`app/dashboard/audit/page.tsx` uses `setInterval(1000)`. Wasteful and forces the `react-hooks/set-state-in-effect` eslint-disable. Swap to `supabase.channel('mcp_events').on('postgres_changes', ...)` so events push only when rows arrive.

- [ ] Realtime subscription with polling fallback if subscribe fails
- [ ] Remove the effect eslint-disable once migrated

## [P2] Periodic MCP tool re-discovery (cron)
Sibling of the manual rediscover button. Nightly cron that re-discovers + diffs all registered MCP servers. Supabase scheduled functions or Vercel cron. Out of scope for single-user demo; matters when users register third-party MCP servers and expect the manifest to stay fresh.

## [P2] Zod-validate MCP gateway responses in graph page
`app/dashboard/graph/page.tsx:100` parses `/api/mcp` JSON-RPC body with `as { result?: TrelResponse; ... }` — no runtime check. Gateway is our own code so risk is low, but it violates the CLAUDE.md boundary-validation rule. Add a Zod schema next to `TrelResponse` and `.safeParse()` before consuming.

## [P2] SSE multi-event parser for MCP gateway responses
`lib/mcp/discover-tools.ts` and the graph page both regex `text.match(/data:\s*(\{[\s\S]*?\})/)` to pull a single SSE event. Fine today (one event per response); breaks the instant the gateway streams progressive responses, keepalive frames, or cancellation. Replace with a proper SSE line parser iterating over `data:` events.

## [P2] Split large shadcn primitives if they get hand-edited
`components/ui/sidebar.tsx` (727 lines) and `components/data-table.tsx` (618 lines) exceed the 400-line convention. Vendored shadcn output — splitting breaks the CLI update model. Trigger a split the moment we add project-specific logic beyond trivial adaptation.

## [P2] Sidebar nav badges (counts per section)
Nav items in `components/app-sidebar.tsx` are label-only. Show a count badge next to Servers (tool count), Policies (active count), Audit (events-last-hour) so the sidebar is a glanceable status bar. Requires a shared stats fetcher (Server Component wrapper or context). Low priority — Overview already shows the counts.

## [P2] policy-row micro-fixes
Flagged by the code reviewer on WP-3.5 commit.

- [ ] `components/dashboard/policy-row.tsx:192` — `className="... border border ..."` duplicate utility, remove one
- [ ] `components/dashboard/policy-row.tsx:44` — `new Map(assignments)` rebuilt each render; wrap in `useMemo` if assignment count grows past ~20

## [P2] Replace `export default` in Next.js pages/layouts with named exports
Next.js framework contract requires default exports for `page.tsx` / `layout.tsx` / `route.ts` handlers, so our "named exports only" convention has a built-in carve-out. Document the carve-out in `CLAUDE.md` to stop code reviewers flagging it, or migrate to a wrapper pattern (named export + `export default wrapped`).

---

## Vision gaps from reference architecture (`/projects/semantic-gps/docs`)
Discovered 2026-04-22 when auditing the reference monorepo's `Architecture.md` + `Business Concept.md` against our build. The reference is a 2-person-year roadmap; the hackathon demo only needs the wedge. Parking the full-vision pieces here so nothing gets lost.

## [P2 stretch] Country (Org) multi-tenant hierarchy
Reference has `Country → City → Routes → Places` as a strict hierarchy. Sprint 4 lands `domains` (City) + `routes` + `route_steps` but keeps Country implicit (single-org MVP). Multi-tenant adds RLS + tenant-scoped service-role client + invite flow.

- [ ] `organizations` table + `domains.organization_id` FK
- [ ] RLS re-enabled on all application tables with `auth.uid()` checks
- [ ] Invite/join flow or SSO

## [P2 stretch] Navigation Bundle compile + offline routing
Reference ships "Navigation Bundles": encrypted compiled graph + policies the data plane downloads so it can route without a live control-plane connection. Pure operational feature — zero demo value for judging but enormous for real enterprise sell.

- [ ] Bundle schema: graph + policies + semantic defs, signed + gzipped
- [ ] `POST /api/bundles/compile` emits bundle for a domain
- [ ] Gateway can boot from a bundle file (not just DB)

## [P2 stretch] A2A (Agent-to-Agent) protocol bridge
Reference exposes Routes as both MCP endpoints AND A2A endpoints so multi-agent systems can collaborate through the gateway. MCP is v1; A2A is v2+.

- [ ] A2A card schema + registry
- [ ] Route → A2A card transform
- [ ] Inbound A2A dispatch to Route execution

## [P2 stretch] Simulation Playground / LLM Evaluator
Reference "Simulation Playground" — sandbox that runs a test Agent against a Route and scores whether it can navigate successfully before deploying. Great for demoing but adds a whole sub-product.

- [ ] Harness that runs a scripted agent against a Route with recorded transcripts
- [ ] Pass/fail heuristics: tool-call count, policy violations, goal match
- [ ] Dashboard UI showing per-Route evaluation scores

## [P2] OpenTelemetry distributed tracing
Reference data plane emits OTel traces per Route step. Our `trace_id` in `mcp_events` is good enough for demo; OTel matters when this deploys against real observability stacks (Honeycomb, Datadog).

- [ ] `@opentelemetry/api` + OTLP exporter wiring
- [ ] Span per `execute_route` step, linked to parent trace
- [ ] Env var to point at collector

## [P2] Agent Card Designer — A2A card rewriting
Reference "Agent Card Designer" templating engine — rewrites how tools are presented to agents beyond simple rename (adds examples, preferred patterns, narrative guidance). Sprint 4's semantic-rewriting layer (WP-4.17) handles tool-name aliases; this is the richer version.

- [ ] `agent_card_templates` table — jsonb template per tool/route
- [ ] Render agent cards on `tools/list` with template substitution
- [ ] Dashboard WYSIWYG editor for the template

## [P2 stretch] Semantic Definition Store (universal business meaning)
Reference separates "Meaning" (what a Lead IS) from the underlying API (how Salesforce represents a Lead). Every tool referencing `Lead` pulls from the same definition — the Semantic Map. Huge surface, parked for post-hackathon.

- [ ] `semantic_entities` table — entity name + schema + description
- [ ] Tool input/output schemas reference semantic entities instead of inlining
- [ ] Dashboard to author + version entities

## [P2] Semantic caching on the gateway
Reference "Semantic Router" caches not just data but routing decisions (e.g., "goal X = Route Y") so repeated semantic queries skip re-resolution. Layer on top of the manifest cache, keyed on normalized goal strings.

- [ ] LRU cache keyed on `hash(goal + manifest_version)`
- [ ] Invalidate on relationship/route mutation
- [ ] Telemetry on hit-rate

## [P2 stretch] First-class Rollback Routes
Sprint 4 lands per-step `rollback_tool_id` on `route_steps`. Reference treats Rollback Routes as first-class entities — named, reusable, composable chains (e.g., "undo_lead_conversion" rolls back 3 different tools in reverse). Pull in after MVP if users want reusable rollback flows.

- [ ] `rollback_routes` table referencing an ordered list of compensating tool calls
- [ ] `route_steps.rollback_route_id` replaces (or augments) `rollback_tool_id`
- [ ] Rollback UI in Route designer

## [P2] Rust data plane
Reference's terminal vision has the gateway as a Rust binary for throughput + edge deploy. Our Next.js gateway is good enough for demo and for a hosted SaaS launch; Rust matters when enterprises want self-hosted at scale.

- [ ] Port stateless-server + policy engine + audit logger to Rust
- [ ] Wasm or native distribution; same `/api/mcp` contract
- [ ] Control plane stays Next.js, data plane stays Rust

---

## V2 cuts from USER-STORIES.md (added 2026-04-22 after architect + PO review)
These stories appeared in `docs/USER-STORIES.md` but are out of Sprint-4 scope. Tagged here so they're not lost. Each is tagged V2 in the stories doc too.

## [P1 post-hackathon] Email verification + rate-limit on auth endpoints
Supabase supports both out of the box; deferred for Sprint 4 to stay focused on hero demo.

- [ ] Email verify flow + page
- [ ] Rate-limit on `/api/auth/login`, `/signup`, `/forgot-password` (edge middleware or Supabase-native)

## [P1 post-hackathon] Role promotion + member removal
Single-admin MVP in Sprint 4 (first signup = admin of their own org). Multi-user org needs:

- [ ] `memberships.role` enum expanded beyond `admin`
- [ ] Promote / demote UI in Settings > Organization
- [ ] Remove-member flow

## [P1 post-hackathon] Invite flow (email + unique link)
Covered by the existing "Country (Org) multi-tenant hierarchy" entry above, but called out separately here so the USER-STORIES.md mapping is explicit. Blocked on RLS + multi-tenant schema.

## [P2] Email address change
Dashboard Settings > Profile lets users change their login email. Supabase supports via `updateUser({ email })` with re-verification. Trivial when signup flow ships.

- [ ] Settings > Profile — change-email with re-verification

## [P2] MCP endpoint auth headers UI
Settings > MCP Endpoint Auth — per-user bearer token or header scheme that agents use to authenticate to the gateway endpoints. Sprint 4 WP-D.2 ships gateway auth verification server-side; this is the UI layer for rotating + copying the token.

- [ ] Settings > MCP Endpoint Auth page with token generation + rotation
- [ ] Copy-to-clipboard snippets per auth scheme (Bearer, custom header)

## [P2] Custom policy DSL
Sprint 4 ships 7 built-in policies (PII, rate_limit, allowlist, injection_guard, Basic-auth, client-ID, IP allow/block) which cover the demo. A custom policy DSL (story line 75) is a 2-day product on its own — parser, evaluator, editor, versioning schema, security review. Post-hackathon.

- [ ] DSL grammar (EBNF)
- [ ] Parser + AST evaluator
- [ ] Policy editor with syntax highlight
- [ ] `/api/policies/translate` NL→DSL (requires DSL to exist)

## [P2] Workflow Evaluator benchmark harness (keyword / semantic / hybrid matching)
Original USER-STORIES.md story was a benchmark that compares which matching strategy best surfaces the right tool for a goal. Sprint 4 pivots this into the **Playground A/B demo** instead — richer narrative, less engineering surface. The strategy-comparison harness itself is a standalone eval product.

- [ ] Keyword + embedding + hybrid scoring implementations
- [ ] Golden-set of goal→tool pairs
- [ ] Score board UI comparing strategies

## [P2] Monitoring widget customization
Sprint 4 ships 3 lean widgets fixed. Drag-to-resize, pick-your-widgets is a V2 polish.

- [ ] `user_dashboard_layouts` table
- [ ] Widget registry with per-widget config
- [ ] Drag/resize UI

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
