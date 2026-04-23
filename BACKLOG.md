# claude-hackathon — Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: **P0** = next sprint · **P1** = soon · **P2** = when slack.
> **When a WP is pulled into a sprint, MOVE it out of this file in the same edit.** Shipped history lives in `TASKS.md § Completed Sprints`.

---

## Submission-window — Fri ship + Sat polish + Sun record

Shipping days (CET): **Fri Apr 24 + Sat Apr 25** (2 full days). Recording day: **Sun Apr 26** (full CET day available; submission due Sun 20:00 EST = Mon 02:00 CET). Ordered by judging-signal leverage per CLAUDE.md § Competition Mindset rule #7, not by size.

---

### Friday Apr 24 (CET) — Big shipping day: enterprise shape

Retire the demo-level scaffolding before Saturday's polish pass. All three are enterprise-signal work — judges who browse the source see an enterprise-shaped codebase, not a hackathon scaffold. Order within the day is by architectural risk (do the scariest refactor first while fresh).

#### [P0 Fri] C.6 — Extract SF/Slack/GitHub to standalone MCP servers (L)
Move `lib/mcp/proxy-salesforce.ts` + `proxy-slack.ts` + `proxy-github.ts` out of the gateway. New top-level `mcps/` folder (monorepo), each a standalone Node/Bun app exposing MCP HTTP-Streamable and internally translating to the respective REST API. Demo org registers their URLs via the normal `POST /api/servers` flow — identical to how any tenant would register a third-party MCP. Gateway loses three files and treats every upstream identically.
- Structure: `mcps/salesforce-mcp/`, `mcps/slack-mcp/`, `mcps/github-mcp/` — each with its own `package.json` + Vercel/Fly deploy pipeline
- Each owns its OAuth / credential path (server-side env vars for demo; per-org creds in V2)
- Bootstrap script re-registers the three against local + hosted demo orgs
- Removes `lib/mcp/proxy-*.ts` entirely; `lib/mcp/tool-dispatcher.ts` dispatches only `openapi` + `http-streamable` — no vendor branches

#### [P0 Fri] A.7 — First-signup onboarding wizard (M)
Replaces the `<handle>'s Workspace` auto-org hack. Post-signup flow: `/onboarding` route gated by a `profile_completed boolean` flag (new column on `memberships` or new `profiles` table). Collects first_name + last_name + company + org_name. Refactors the `on_auth_user_created` trigger — user-named org replaces auto-generated name. Redirects to `/dashboard` on completion. Supersedes the V2 `[P1] Signup onboarding — skip auto-workspace` entry (now dropped).

#### [P0 Fri] K.1 — Enterprise data-model audit + fixes (M)
Concrete gaps surfaced during Sprint 13 review:
- `mcp_events` missing `organization_id` column — every monitoring/audit query joins through `servers.id` today. Add column, backfill via existing `server_id → servers.organization_id` lookup, update all writers.
- `organizations` has no billing metadata — add `plan`, `trial_ends_at`, `billing_email`, `created_by` nullable columns. Signal enterprise readiness.
- `memberships.role` CHECK locked to `'admin'` — widen to `admin | member` (no further roles for MVP).
- `domains` concept is underused (one auto-seeded "SalesOps" per signup) — promote to "environments" (prod/staging) semantics OR drop the table entirely. Decide + execute.
- `gateway_tokens.organization_id` ON DELETE CASCADE footgun — delete org → tokens vanish without audit. Evaluate soft-delete alternative.
- Policy-fork vs policy-reference model review — today assignments are the fork point; document the invariant or refactor.

Deliverable: one migration with the clean schema changes + updated writers + a one-paragraph note in `docs/ARCHITECTURE.md` on the final multi-tenant shape.

---

### Saturday Apr 25 (CET) — Final polish: landing page + demo prep

Day centerpiece is the landing page rewrite, AFTER demo narrative is locked in the AM. Recording is Sunday — Saturday is when the product's front door gets its judging-signal polish and the demo gets rehearsed through the Playground UI.

#### [P0 Sat AM] Finalize demo narrative
Code ships regardless of framing. Nail the story Sat morning once all MCPs + routes + policies are live and we can see what the demo actually looks like on screen. Constraint: avoid positioning as an Agentforce competitor (Mihael works at Salesforce). Candidate angles:
- "Complements Agentforce" — Agentforce for in-SF, Semantic GPS for cross-surface hops (GH/Slack). Governance on the outbound.
- AI security / trust — agent leaks, prompt injection, data exfiltration news lines up with the gateway's capability set. Natural fit for "Keep Thinking" $5K prize.
- DevOps-first fallback — GH issue → Linear/Jira → Slack → PagerDuty. Lowest-risk if SF angle feels close to the line.

Deliverables once picked: ≤15-word pitch, Playground A/B pane script, PII target tool, README positioning paragraph.

#### [P0 Sat AM] Validate Playground presets against live agent flow
Sprint 10 validation tested gateway behaviour via direct JSON-RPC, NOT the Playground UI's Anthropic agent loop. Before Sunday recording, drive each preset through the actual UI to confirm tool picks + pane contrast + tunnel wiring. Rewrite prompts if agent picks the wrong tool order.
- Start `cloudflared tunnel --url http://localhost:3000`, point `NEXT_PUBLIC_APP_URL` at it
- Run each preset on `/dashboard/playground`; screen-record both panes; match against DEMO.md script

#### [P0 Sat PM] Landing page rewrite — highest ranking lever (M)
Current landing is black-void hero + text-only pitch + muted grey CTA + Next.js N-logo. Judges see it in 3 seconds and bounce. Estimated ranking: ~350/500 currently; proper landing moves to ~100/500. Per CLAUDE.md § Competition Mindset rule #1, this is the single highest-leverage Sat move — judges see this BEFORE the demo video, BEFORE the dashboard, BEFORE the source.

Required minimum:
- Plain-English headline — drop jargon stacks; try "Governance + observability for agentic AI. One gateway across every MCP."
- Bold primary CTA in brand color (not muted grey); secondary CTA for GitHub
- Hero media slot: 5-10s loop of saga rollback cascade OR Workflow Graph
- Stat strip: "12 built-in policies · 8 canonical relationship types · 3 demo MCPs unified · Opus 4.7 with extended thinking"
- Architecture diagram embed (from VISION.md or regenerated)
- Screenshot grid: Dashboard + Workflow Graph + Playground A/B + Policy timeline
- "Built with Claude Opus 4.7" badge + stack-logo strip (Next.js · Supabase · Anthropic SDK · React Flow)
- Kill the Next.js `N` logo in the bottom-left corner
- Demo video embed above the fold once Sunday's recording is up
- "Submitted to Cerebral Valley hackathon 2026" signal

Approach: plan first per CLAUDE.md, then parallel subagents — hero + copy lane A, stat strip + architecture embed lane B, screenshot grid + polish lane C. Content derives from Sat AM's finalized narrative.

---

### Sunday Apr 26 (CET) — Record + submit

Full CET day available. No feature work — only recording, doc polish, and the submission itself. Submission deadline: 20:00 EST = **Mon Apr 27 02:00 CET**.

- [ ] Record 3-min demo video — hero ~75s + OpenAPI import ~45s + workflow graph ~30s + intro/outro ~30s. Do 5 takes; pick best.
- [ ] Cut in iMovie / DaVinci, scripted voiceover from Sat AM's narrative, no filler.
- [ ] Upload to YouTube unlisted + Loom + Drive; paste 3 URLs into `docs/SUBMISSION.md`.
- [ ] README final pass — any drift since Sprint 11 rewrite, demo links, env table parity with `.env.example`.
- [ ] SUBMISSION.md finalize — 150-word summary locked, repo + live + vision + demo video links in.
- [ ] Embed Sunday's demo video above the fold on landing page (slot left open Sat PM).
- [ ] Submit via CV platform before 20:00 EST = Mon 02:00 CET.
- [ ] Contingency re-record window if first take looks off — full Sun day gives 2-3 takes worth of buffer.

---

## Sprint queue — daily pulls

Dep convention: `← blocked by X` / `→ blocks Y`. Sizes: S / M / L (human-dev estimate; Claude wall-clock fractional).

### A. Platform — Auth + Org + Settings
- **A.3** (S) Password reset flow (request + submit).
- **A.5** (S) Settings page — username + org name edit.

### C. Real proxy layer
- **C.4** (M) Multi-origin per server + health-driven origin swap. ← F.4

### F. Routes + stateful orchestration
- **F.4** (S) Origin health probes (`/api/health/:server_id`, cached flag). → C.4, G.7

### G. TRel + policies + authoring UI

Policy taxonomy garnish (seven dimensions already covered — these are additive):
- Time/state gates — `maintenance_windows` builtin
- Kill switches — `destructive_tool_tagging` builtin

Open WPs:
- **G.8** (S) Graph: domain-boundaries toggle + per-server policy count badge.

### H. Monitoring + overview
- **H.2** (S) Overview dashboard domain filter.

### I. Opus 4.7 showcase + visual beats
- **I.3** (L, P1 stretch) Opus relationship inference on OpenAPI import. Feed full spec to Opus 4.7 with cached system prompt; user approves/rejects proposals before persist; thinking blocks surface reasoning. 1M-context showcase.
- **I.5** (M, P2 stretch) Managed Agents wrap for demo agent ($5K side prize). Port agent loop from `@anthropic-ai/sdk` manual to Managed Agents API; point at deployed `/api/mcp`; keep SDK fallback. **Apply only to demo agent, never to product gateway.** Demoted Sprint 13 — deprioritized against Route designer visibility.
- **I.6** (L, P2 stretch) Playground "Refine with Opus" button backed by Managed Agents. Ingest scenario prompt + both panes' traces + policy events + manifest; return structured suggestions as cards ("flip policy X to enforce", "add produces_input_for edge Y→Z"). Refinement-as-a-service framing. ← I.5

### J. Demo + verification
- **J.2** (M) End-to-end verification against Vercel — opt-in Anthropic vitest extended to Playground route.

---

## Sprint 5 follow-up hardening (P1 post-hackathon)
Reviewer-flagged; non-blocking. Pull when slack or at V2.

- `lib/manifest/cache.ts` — `fetchOrgManifest` pulls ALL `route_steps` (no filter); align with `fetchDomainManifest` pattern. Would-be cross-tenant leak at V2.
- `lib/policies/built-in.ts` — `runIpAllowlist` IPv4-only; IPv6 silently denied. Add IPv6 CIDR matcher.
- `lib/manifest/cache.ts` — extract `fetchByIds<T>` helper; `fetchOrgManifest` + `fetchDomainManifest` exceed 50-line convention.
- `app/api/mcp/domain/[slug]/` + `server/[id]/` — Zod `safeParse` on route params; clean 400 instead of Postgres UUID error.
- `lib/mcp/gateway-handler.ts` — `x-forwarded-for` trusted unconditionally. Safe on Vercel, spoofable self-hosted. Add `TRUSTED_PROXY_ENABLED` flag.
- `lib/mcp/stateless-server.ts` — `createStatelessServer` at 180 lines; extract request handler blocks.
- `lib/policies/enforce.ts` — retrofit the 7 older runners (`pii_redaction`, `rate_limit`, `allowlist`, `injection_guard`, `basic_auth`, `client_id`, `ip_allowlist`) with per-builtin Zod `safeParse` + fail-closed `*_config_invalid` verdicts so DB-stored config can't crash the runner.

---

## Polish + robustness

### [P2 stretch] Natural-language policy author
User types "block PII on external domains after 6pm" → Opus returns JSON matching one of the 12 builtin schemas; user reviews before save. Textarea + "Ask Opus" button in policy editor. Demo garnish.

### [P1] Rediscover-tools button on server cards
Direct-MCP imports run `tools/list` once at register. Add per-server action that re-runs `discoverTools()`, diffs against current table (insert/delete/update), invalidates manifest. `POST /api/servers/:id/rediscover`.

### [P1] Real event aggregation for Overview chart
`components/chart-area-interactive.tsx` ships 2024 fixture data. Replace with `/api/gateway-traffic?range=7d|30d|90d` aggregating `mcp_events` by day split by `status === 'ok'` vs `blocked_by_policy`. Keep fixture as fallback when DB empty.

### [P1] Supabase realtime for audit page
`app/dashboard/audit/page.tsx` uses `setInterval(1000)` — wasteful, forces eslint-disable. Swap to `supabase.channel('mcp_events').on('postgres_changes', ...)` with polling fallback on subscribe failure.

### [P2] Periodic MCP tool re-discovery (cron)
Sibling of manual rediscover button. Vercel cron or Supabase scheduled function. Matters when users register third-party MCPs.

### [P2] Zod-validate MCP gateway responses in graph page
`app/dashboard/graph/page.tsx:100` uses `as { result?: TrelResponse; ... }` without runtime check. Add Zod schema + `safeParse`. Violates boundary-validation rule.

### [P2] SSE multi-event parser
`lib/mcp/discover-tools.ts` + graph page both regex a single `data:` event. Breaks when gateway streams progressive responses / keepalives. Replace with proper SSE line parser.

### [P2] Strip internal error text from API responses
Several routes bubble `{ error: ..., details: err.message }`. Violates "never expose internal error details." Replace with `console.error` + opaque `error_code`. Target: `/api/servers`, `/api/openapi-import`, `/api/policies*`.

### [P2] SSRF guard DNS-rebinding hardening
`lib/security/ssrf-guard.ts` validates DNS on entry but `fetchWithTimeout` re-resolves on the actual request. Canonical fix: pin pre-validated IP into custom `undici.Agent` with fixed `lookup`. Pull when wiring real third-party MCP imports.

### [P2] ReDoS guard on policy config regex
`compilePatterns` does `new RegExp(config.patterns[].regex, 'gi')` with no validation. Before multi-tenancy: `safe-regex` pre-validate on policy write OR runtime fuse on `runPiiRedaction` scan.

### [P2] GitHub repo metadata polish
About section + website URL + 1280×640 social preview OG image + verify LICENSE renders in GitHub About + repo topics match final scope.

### [P2] Cosmetic cleanup
- `components/ui/button.tsx` — shadcn ships without semicolons; `.prettierrc` wants them. `pnpm exec prettier --write components/ui` next time it's touched.
- `components/ui/sidebar.tsx` (727 lines) + `components/data-table.tsx` (618 lines) — exceed 400-line convention but vendored shadcn. Split on first project-specific hand-edit.
- `components/dashboard/policy-row.tsx` — `new Map(assignments)` rebuilt each render; useMemo when assignment count grows past ~20.
- Document `export default` carve-out for Next.js `page.tsx` / `layout.tsx` / `route.ts` in CLAUDE.md to stop reviewer flags.

### [P2] Split `playground-workbench.tsx`
Sprint 12 pushed `components/dashboard/playground-workbench.tsx` to 431 lines (over the 400-line cap). Extract `PaneView` + the `applyEvent` reducer + the stream-parser into colocated files. Mechanical split; no behaviour change.

### [P2] `AbortController` on PolicyTimelineChart fetch
`components/dashboard/policy-timeline-chart.tsx` uses a `cancelled` boolean flag to skip post-unmount setState but doesn't abort the in-flight fetch. Canonical pattern: `const ctl = new AbortController()` + `signal: ctl.signal` + cleanup `ctl.abort()`.

### [P2] Sidebar nav badges
Count badges on Servers (tools), Policies (active), Audit (events-last-hour). Needs shared stats fetcher. Overview already shows the counts — low priority.

---

## V2 — post-hackathon

### [P1] Multi-tenancy — RLS + invite flow (L)
Enable RLS on all app tables (with SECURITY DEFINER helper `public.current_user_orgs()` for gateway service-role path + cross-org manifest lookups by server_id). Widen `memberships.role` enum past `'admin'` to `admin | member`. Signed-link invite flow: `public.invites` table + `POST /api/invites` returning JWT link + `/invite?token=` landing + `on_auth_user_created` trigger refactor to consume `raw_user_meta_data.invite_code`. Settings page org-members UI: list + copy-invite-link + remove-member. Cut lines: no org-switching UI, no roles beyond admin/member, no SSO/SCIM.

### [P1] Email verification + rate-limit on auth endpoints
Supabase-native for both; deferred for demo focus.

### [P2] Custom policy DSL
Grammar + parser + AST evaluator + syntax-highlight editor. 2-day product. Distinct from NL policy author (which targets existing builtin schemas).

### [P2] Workflow Evaluator benchmark harness
Keyword / embedding / hybrid scoring implementations + golden goal→tool pairs + scoreboard UI. Standalone eval-harness product; distinct from the Playground A/B demo surface.

### [P2] Email address change
Settings > Profile via Supabase `updateUser({ email })` + re-verification.

### [P2] Monitoring widget customization
`user_dashboard_layouts` table + widget registry + drag/resize.

---

## Vision gaps — post-hackathon architecture
Full detail in [`VISION.md`](./VISION.md). Listed here for backlog tracking.

- **Navigation Bundle compile + offline routing** — signed/gzipped graph+policies+semantic-defs bundle; gateway boots from bundle file for air-gapped.
- **A2A protocol bridge** — expose Routes as A2A endpoints in addition to MCP.
- **Simulation Playground / LLM Evaluator** — sandbox agent scored against a Route before deploy.
- **OpenTelemetry distributed tracing** — OTel span per `execute_route` step; env-configured OTLP exporter.
- **Agent Card Designer** — richer semantic rewriting via jsonb templates per tool/route; WYSIWYG editor.
- **Semantic Definition Store** — `semantic_entities` table; tool schemas reference entities instead of inlining.
- **Semantic caching on gateway** — LRU keyed on `hash(goal + manifest_version)`.
- **First-class Rollback Routes** — named reusable compensation chains; `rollback_routes` table + `route_steps.rollback_route_id`.
- **Rust data plane** — port `stateless-server` + policy engine + audit logger; Wasm + native distribution.

<!-- Add deferred features here. Format:
### [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
