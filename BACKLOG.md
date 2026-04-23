# claude-hackathon — Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: **P0** = next sprint · **P1** = soon · **P2** = when slack.
> **When a WP is pulled into a sprint, MOVE it out of this file in the same edit.** Shipped history lives in `TASKS.md § Completed Sprints`.

---

## Submission-window — still open for Sat + Sun

### [P0 Sat AM] Finalize demo narrative
Code ships regardless of framing. Nail the story Sat morning once all MCPs + routes + policies are live and we can see what the demo actually looks like on screen. Constraint: avoid positioning as an Agentforce competitor (Mihael works at Salesforce). Candidate angles:
- "Complements Agentforce" — Agentforce for in-SF, Semantic GPS for cross-surface hops (GH/Slack). Governance on the outbound.
- AI security / trust — agent leaks, prompt injection, data exfiltration news lines up with the gateway's capability set. Natural fit for "Keep Thinking" $5K prize.
- DevOps-first fallback — GH issue → Linear/Jira → Slack → PagerDuty. Lowest-risk if SF angle feels close to the line.

Deliverables once picked: ≤15-word pitch, Playground A/B pane script, PII target tool, README positioning paragraph.

### [P0 Sat AM] Record demo clip — CANNOT SLIP
Saturday recording IS the submission video. Sunday is for summary + upload only, not debugging.
- Hero scenario (~75s) + OpenAPI import (~45s) + workflow graph (~30s) + intro/outro (~30s) = 3 min
- Cut in iMovie / DaVinci, scripted voiceover, no filler
- Upload to YouTube unlisted + Loom + Drive; paste 3 URLs into `docs/SUBMISSION.md`

### [P0 Sat AM] Validate Playground presets against live agent flow
Sprint 10 validation tested gateway behaviour via direct JSON-RPC, NOT the Playground UI's Anthropic agent loop. Before recording, drive each preset through the actual UI to confirm tool picks + pane contrast + tunnel wiring. Rewrite prompts if agent picks the wrong tool order.
- Start `cloudflared tunnel --url http://localhost:3000`, point `NEXT_PUBLIC_APP_URL` at it
- Run each preset on `/dashboard/playground`; screen-record both panes; match against DEMO.md script

### [P0 Sat AM] Recording-day env — `SEMANTIC_GPS_DEMO_MODE`
Env var that auto-loosens default policy enforcement on startup so Sunday recording doesn't trip the business-hours window cold. Reads the env on `createServiceClient` boot; defaults to off.

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
- **G.3** (L) Route designer UI — React Flow step editor + rollback/fallback wiring.
- **G.7** (M) Per-server detail — violation counts + copy-ready MCP client config block + resources/prompts introspect. ← F.4
- **G.8** (S) Graph: domain-boundaries toggle + per-server policy count badge.
- **G.17** (S) Compensation edges for writes beyond GitHub. `chat_post_message` + `create_task` have no `compensated_by` in seed — rollback leaves orphaned Slack messages + SF tasks. Needs new `delete_message` (Slack `chat:write`/`chat:delete` scopes) + `delete_task` (SF) tools + edges. Makes rollback demo honest E2E instead of GitHub-only.
- **G.18** (S, dev workflow) Manifest cache invalidation endpoint. Direct DB mutations bypass `invalidateManifest()`; Sprint-10 workaround was bumping `__HMR_NONCE__`. Canonical fix: dev-gated `POST /api/_internal/manifest/invalidate` (404 in prod) OR swap singleton Map for DB `revision` int + per-request freshness check.

### H. Monitoring + overview
- **H.1** (M) Monitoring page — 3 lean widgets: call volume, policy violations over time, PII detections by pattern.
- **H.2** (S) Overview dashboard domain filter.

### I. Opus 4.7 showcase + visual beats
- **I.1** (M, **P0 stretch**) Extended-thinking blocks live-rendered in Playground governed pane. SSE stream of thinking events → collapsible "Show reasoning" toggle.
- **I.3** (L, P1 stretch) Opus relationship inference on OpenAPI import. Feed full spec to Opus 4.7 with cached system prompt; user approves/rejects proposals before persist; thinking blocks surface reasoning. 1M-context showcase.
- **I.4** (M, P1 stretch) Shadow → enforce timeline — 7-day would-have-blocked trail per policy.
- **I.5** (M, P1 stretch) Managed Agents wrap for demo agent ($5K side prize). Port agent loop from `@anthropic-ai/sdk` manual to Managed Agents API; point at deployed `/api/mcp`; keep SDK fallback. **Apply only to demo agent, never to product gateway.**
- **I.6** (L, P1 stretch) Playground "Refine with Opus" button backed by Managed Agents. Ingest scenario prompt + both panes' traces + policy events + manifest; return structured suggestions as cards ("flip policy X to enforce", "add produces_input_for edge Y→Z"). Refinement-as-a-service framing. ← I.5

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

### [P1] Signup onboarding — skip auto-workspace
Current trigger always creates `<handle>'s Workspace`. For shared-Demo-Org flows the user lands in an empty workspace. Fix via `SEMANTIC_GPS_SINGLE_ORG_MODE` env (skip org creation, attach membership to first org) OR dashboard-level prompt to join shared Demo Org with atomic reparent. Also fix `gateway_tokens.organization_id` ON DELETE CASCADE footgun.

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
