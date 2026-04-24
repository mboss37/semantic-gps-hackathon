# claude-hackathon — Backlog

> **P0** = ships before Sun Apr 26 12:00 CET code freeze. Goal: everything done Sat EOD; Sun AM coding only if emergency.
> **P1** = nice-to-have if P0 is done; squeeze in Fri/Sat if bandwidth allows.
> **Post-hackathon** = V2 + forward-looking vision items. Shown to judges who browse deep, signals ambition beyond the hackathon window.
> **When a WP is pulled into a sprint, MOVE it out of this file in the same edit.** Shipped history lives in `TASKS.md § Completed Sprints`.

---

## P0 — Must ship before code freeze

Shipping window: **Fri Apr 24 + Sat Apr 25 (full coding days, CET)**. Sun Apr 26 AM = emergency coding only. Hard code freeze: **Sun 12:00 CET**. Demo prep starts then — no commits after.

### Friday Apr 24 (CET) — Full coding day: enterprise shape

_(all pulled — Sprint 15 + Sprint 16)_

### Saturday Apr 25 (CET) — Full coding day: narrative + polish + landing

Day closes with all coding done. Narrative locks in the AM so landing-page copy derives from it in the PM.

#### [P0 Sat AM] Finalize demo narrative
Nail the story Sat morning once all MCPs + routes + policies are live and we can see what the demo looks like on screen. Constraint: avoid positioning as an Agentforce competitor (Mihael works at Salesforce). Candidate angles:
- "Complements Agentforce" — Agentforce for in-SF, Semantic GPS for cross-surface hops (GH/Slack). Governance on the outbound.
- AI security / trust — agent leaks, prompt injection, data exfiltration news lines up with the gateway's capability set. Natural fit for "Keep Thinking" $5K prize.
- DevOps-first fallback — GH issue → Linear/Jira → Slack → PagerDuty. Lowest-risk if SF angle feels close to the line.

Deliverables once picked: ≤15-word pitch, Playground A/B pane script, PII target tool, README positioning paragraph.

#### [P0 Sat AM] Validate Playground presets against live agent flow
Sprint 10 validation tested gateway behaviour via direct JSON-RPC, NOT the Playground UI's Anthropic agent loop. Before Sunday recording, drive each preset through the actual UI to confirm tool picks + pane contrast + tunnel wiring. Rewrite prompts if agent picks the wrong tool order.
- Start `cloudflared tunnel --url http://localhost:3000`, point `NEXT_PUBLIC_APP_URL` at it
- Run each preset on `/dashboard/playground`; screen-record both panes; match against DEMO.md script

#### [P0 Sat PM] Landing page rewrite — highest ranking lever (M)
Current landing is black-void hero + text-only pitch + muted grey CTA + Next.js N-logo. Judges see it in 3 seconds and bounce. Per CLAUDE.md § Competition Mindset rule #1, this is the single highest-leverage Sat move — judges see this BEFORE the demo video, BEFORE the dashboard, BEFORE the source.

Required minimum:
- Plain-English headline — drop jargon stacks; try "Governance + observability for agentic AI. One gateway across every MCP."
- Bold primary CTA in brand color (not muted grey); secondary CTA for GitHub
- Hero media slot: 5-10s loop of saga rollback cascade OR Workflow Graph
- Stat strip: "12 built-in policies · 8 canonical relationship types · 3 demo MCPs unified · Opus 4.7 with extended thinking"
- Architecture diagram embed (from VISION.md or regenerated)
- Screenshot grid: Dashboard + Workflow Graph + Playground A/B + Policy timeline
- "Built with Claude Opus 4.7" badge + stack-logo strip (Next.js · Supabase · Anthropic SDK · React Flow)
- Kill the Next.js `N` logo in the bottom-left corner
- Demo video embed slot — render from `NEXT_PUBLIC_DEMO_VIDEO_URL`; empty env = no slot. Set the env Sun after recording upload; zero code change.
- "Submitted to Cerebral Valley hackathon 2026" signal

Approach: plan first per CLAUDE.md, then parallel subagents — hero + copy lane A, stat strip + architecture embed lane B, screenshot grid + polish lane C. Content derives from Sat AM's finalized narrative.

### Sunday Apr 26 AM (CET) — Emergency coding only, freeze at 12:00

- If any P0 slipped Fri/Sat, finish here. Otherwise no commits.
- Final `pnpm supabase db reset` + full local validation pass + deploy to Vercel + verify hosted works end-to-end.
- **12:00 CET = hard code freeze.** Demo prep below starts. No commits after this point.

---

## Demo preparation — Sun Apr 26 12:00 CET onward

Video + submission only. No code changes.

### Story preparation
- Lock positioning angle from Sat AM narrative options (SF complements Agentforce / AI security / DevOps-first)
- Write 3-min script — scene-level timings: hero 75s + OpenAPI import 45s + workflow graph 30s + intro/outro 30s
- Rehearse out loud with UI open; time each scene; tighten copy until under 3:00

### Recording
- Screen recorder: **QuickTime** (macOS native, no watermark; Loom free tier watermarks)
- Microphone check + ambient noise level before first take
- Reset demo data between takes: `node scripts/cleanup-demo-data.mjs` (built Sprint 11)
- 5 takes of hero scenario; pick best
- Edit in iMovie / DaVinci / CapCut — cuts, voiceover sync, no filler frames
- Export 1080p MP4, target <200MB for easy upload
- YouTube thumbnail — hero screenshot with product name overlay
- Upload to YouTube unlisted + Loom mirror + Drive backup; capture 3 URLs

### Submission
- `docs/SUBMISSION.md` final — 150-word summary locked, 25-word elevator pitch, repo + live + vision + 3 video links embedded
- `README.md` final pass — demo video embed, env table parity with `.env.example`, LICENSE reference
- `LICENSE` file present (MIT or Apache-2.0); verify GitHub renders it in About sidebar
- Repo public + accessible without auth
- Deployed Vercel URL end-to-end verified — `/dashboard` loads, Playground preset runs, audit entry lands
- Set `NEXT_PUBLIC_DEMO_VIDEO_URL` on Vercel to the YouTube embed URL → landing page picks up the slot without a code change
- GitHub repo polish — About section + website URL (Vercel) + 1280×640 social preview OG image + verify LICENSE renders + topics match final scope
- Submit via CV platform before **20:00 EST = Mon Apr 27 02:00 CET**

### Contingency
- Keep last 3 takes on disk — artifacts often noticed post-edit
- Fallback positioning ready if primary narrative angle feels off on camera
- Sun 14:00–18:00 CET buffer for re-record if first cut looks wrong

---

## P1 — Nice-to-have if all P0 ships

Squeeze in between P0 items Fri/Sat if bandwidth allows. None of these are demo-critical.

### Saturday soft-launch readiness — verify by EOD Friday

Mihael wants to share the live URL Sat AM for real users to sign up, onboard, register their own MCPs. Pre-launch smoke checklist — all of these need to pass on the hosted Vercel deploy before the link goes out.

- **Empty-state dashboard audit (M).** We've only ever tested with the demo seed populated (3 servers / 14 tools / 12 relationships / 4 policies). Sign up a fresh test account on hosted Vercel in a private window and click every dashboard nav item. Known risk areas:
  - Overview chart with zero `mcp_events` rows
  - Monitoring widgets with zero data
  - **Playground** page with no gateway token + no registered server (most likely to blow up)
  - Workflow Graph with zero nodes
  - Routes list / Audit feed / Policy list / Relationships list — all should show honest empty states, not error cards
- **Gateway token auto-mint on signup (S).** `handle_new_user` trigger today creates org + admin membership + `salesops` domain but NOT a `gateway_tokens` row. Fresh signup → Playground → fails because no bearer. Options: (a) extend trigger to mint a default token, (b) add a "Mint your first token" step to the onboarding wizard, (c) auto-create on first `/dashboard/tokens` visit. Pick one.
- **Email verification flow (S).** Check hosted Supabase auth settings — is "Confirm email" on? If yes, users can't log in until they click the email link, and the free-tier SMTP often looks like spam / rate-limits. Decide: (a) disable email confirmation for Saturday (cost: trivial spoof risk), (b) configure Resend SMTP, (c) leave on and hope for the best. Document the decision.
- **Signup rate limit / abuse (S).** Public URL on Twitter or similar = DDoS / spam vector. Supabase has some built-in protection but nothing aggressive. Accept for the Saturday cohort (curated audience) — formal rate-limit is V2. Just note the risk.
- **Vercel env vars for vendor MCPs.** Add `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SLACK_BOT_TOKEN`, `GITHUB_PAT` to the Vercel project (all environments) + redeploy. Without these the demo org's 3 pre-seeded servers answer `credentials_missing`. **Blocker for demo-day recording; not a blocker for user signups** (new orgs register their own servers with their own creds).
- **Empty-state smoke commands** — run against the hosted Vercel URL:
  - Sign up → confirm (if required) → onboarding → dashboard lands cleanly
  - Click each sidebar item → no crashes
  - Register a test MCP server via the register UI
  - Mint a gateway token via `/dashboard/tokens`
  - Curl `/api/mcp` with the token → `tools/list` returns
  - If all pass → share link. If any fail → patch, redeploy, retry.



- **I.5** Managed Agents wrap for demo agent — $5K side prize lever (M). Port agent loop from `@anthropic-ai/sdk` manual to Managed Agents API; point at deployed `/api/mcp`; keep SDK fallback. Apply ONLY to demo agent, never to product gateway.
- **I.6** Playground "Refine with Opus" button (L, chains after I.5). Ingest scenario prompt + both panes' traces + policy events + manifest; return structured suggestions as cards ("flip policy X to enforce", "add produces_input_for edge Y→Z").
- **I.3** Opus relationship inference on OpenAPI import (L). Feed full spec to Opus 4.7 with cached system prompt; user approves/rejects proposals before persist; thinking blocks surface reasoning. 1M-context showcase.
- **Natural-language policy author** — user types "block PII on external domains after 6pm" → Opus returns JSON matching one of the 12 builtin schemas; user reviews before save. Textarea + "Ask Opus" button in policy editor.
- **J.2** End-to-end Vercel verification — opt-in Anthropic vitest extended to Playground route. Insurance against deploy drift.
- **Supabase realtime for audit page** — swap `setInterval(1000)` for `supabase.channel('mcp_events').on('postgres_changes', ...)` with polling fallback.
- **C.4** Multi-origin per server + health-driven origin swap (M, blocked by F.4).
- **G.8** Graph: domain-boundaries toggle + per-server policy count badge (S).
- **H.2** Overview dashboard domain filter (S).
- **A.3** Password reset flow — request + submit (S).
- **A.5** Settings page — username + org name edit (S).
- **`maintenance_windows`** builtin policy — additive to time/state taxonomy (13th builtin).
- **`destructive_tool_tagging`** builtin policy — additive to kill-switches taxonomy (14th builtin).

### Identified issues (from Sprint 14 + 15 code reviews)
Concrete rough edges surfaced by reviewers. Not demo-blocking; worth a pass if bandwidth allows before freeze, otherwise V2.

**From Sprint 14:**
- **Auth-config decode duplication in 2 proxy files** — `lib/mcp/proxy-openapi.ts` + `lib/mcp/proxy-http.ts` each carry their own copy of `EncryptedAuthSchema` + `AuthConfigSchema` + `decodeAuthConfig`. Consolidate to the `lib/servers/auth.ts` helper shipped Sprint 14.3. (Original 5-file scope shrunk to 2 after C.6 deleted salesforce/slack/github-auth.ts in Sprint 15.) 15-30 min.
- **Rediscover `tools` upsert vs Promise.all fan-out** — `app/api/servers/[id]/rediscover/route.ts::applyDiff` issues N individual `UPDATE` statements instead of one upsert keyed on `(server_id, name)`. Demo-scale (≤20 tools/server) makes it cosmetic; first step is verifying / adding the UNIQUE constraint, may require a migration.
- **`console.error` leaking Supabase error bodies** — `app/api/gateway-traffic/route.ts:55` and ~10 similar sites across route handlers log raw error objects (can include connection strings / stack traces on infra failures). Swap to a structured logger or strip to typed codes before logging. Codebase-wide sweep.
- **Rediscover button lacks dry-run preview** — `components/dashboard/server-rediscover-button.tsx` commits the diff without showing users what would change first. Needs a GET endpoint returning `{toAdd, toUpdate, stale}` without writing; users confirm, then POST commits. New WP, not a spot fix.

**From Sprint 15:**
- **`lib/mcp/execute-route.ts` over 400-line cap (794 lines)** — grew 13 lines in K.1's `organization_id` threading. Extract `executeRollback` (~155 lines) to `lib/mcp/execute-rollback.ts`; file drops under the cap and rollback tests colocate.
- **Onboarding action `created_by` clobber on retry** — `app/onboarding/actions.ts:64-65` sets `created_by` on every submission. Idempotent-retry-safe today because `already_completed` short-circuits, but a partial-failure retry could overwrite the original creator audit trail. Switch to `.is('created_by', null)` or upsert-style guard in the UPDATE.
- **`scripts/bootstrap-local-demo.sql` hardcodes localhost** — `origin_url='http://localhost:3000/...'` requires manual sed-replace before hosted sync. Failure is LOUD on hosted (SSRF guard rejects), but templating via `psql -v base_url=...` or a wrapper shell script removes the footgun.
- **`proxy.ts` DB query per dashboard request** — `memberships.profile_completed` lookup added in A.7 runs on every authed dashboard/onboarding hit. Fine at demo scale (B-tree on unique index). V2 RLS work should fold the flag into the JWT custom claim so the edge check is zero-RTT.
- **`app/onboarding/actions.ts:47-55` let-ctx style** — two-step `let ctx; try { ctx = await requireAuth() } catch` makes `ctx` possibly-undefined to TS flow analysis. Works because `UnauthorizedError` branch returns; stylistic nit — IIFE or dedicated helper would tidy.

**From Sprint 15 multi-tenancy sweep (post-review):**
- **`gateway-handler.ts` auth-fail payload captures `request.url`** — query-string secrets without a `Bearer`/JWT/`sk-*` prefix pass through `redactPayload` untouched. Low-likelihood leak vector. Fix: strip the search portion of the URL entirely before logging, or extend `redactPayload` with a `SECRET_QUERY_PARAM_RE` that masks values for keys like `token|access_token|api_key|password`.
- **`bootstrap-local-demo.sql` silent no-op when demo membership missing** — DELETE subquery `= (SELECT ... WHERE user_id = '11111111-...')` returns NULL if seed hasn't run, and `= NULL` predicates return UNKNOWN → zero rows deleted with no error. Safe but invisible. Fix via the same wrapper-script templating as the localhost issue: fail-loud if demo org not found.
- **`app/api/policies/[id]/assignments/route.ts` POST handler at 88 lines** — over the 50-line convention after the added policy-org verification. Extract `verifyAssignmentTarget(supabase, orgId, {server_id?, tool_id?})` to `lib/policies/assignments.ts`.
- **shadcn-vendored components use double-quote + unsemicolon style** — `nav-user.tsx`, `app-sidebar.tsx`, `nav-main.tsx`, `site-header.tsx`. Project convention is single-quote + semis (see `.claude/rules/conventions.md`). Cosmetic sweep for a quiet sprint.

**From Sprint 16 (playground token hygiene + no-MCP guard + empty-defaults — surfaced during RLS validation):**
- **[P0 NEXT SPRINT] Policy catalog is invisible to new users (Mulesoft-pattern gap)** — `/dashboard/policies` shows a list of existing org-scoped policy **instances**. New users have zero instances → empty page → zero sense of what the platform offers. The 12 builtin runners in `lib/policies/runners/*.ts` (`pii_redaction`, `injection_guard`, `rate_limit`, `allowlist`, `business_hours`, `write_freeze`, `basic_auth`, `client_id`, `ip_allowlist`, `geo_fence`, `agent_identity_required`, `idempotency_required`) ARE the catalog, but they're hidden behind the "Create policy" modal's `builtin_key` dropdown. **Demo-day risk: judge signs up and sees nothing of what Semantic GPS does.** Fix: browsable catalog gallery at `/dashboard/policies/catalog` (or a tab on the policies page) — each card shows name + one-line description + config schema preview + "Apply to my org" CTA that deep-links into the create-instance form with the builtin pre-selected. Zero auto-seeding; user is always the one who creates instances. Mirrors Mulesoft / Cloudflare WAF / AWS IAM template galleries.
- **[P0 NEXT SPRINT] Playground silently mints gateway tokens without consent** — `app/api/playground/run/route.ts::mintPlaygroundToken` INSERTs into `gateway_tokens` on every "Execute" click (both panes = 2 per run). Zero cleanup → tokens pile up in `/dashboard/tokens`. **Violates user consent — tokens are credentials, the user must be the only one who creates them.** Canonical fix: stop auto-minting. The playground reuses a single **internal, system-owned** token marked `kind='system'` (never displayed in the tokens UI, never rotated by the user). Migration adds `gateway_tokens.kind text not null default 'user' check (kind in ('user','system'))`; tokens route filters `kind='user'`; playground reads/creates the `kind='system'` row on first call then reuses it forever.
- **Playground runs with zero MCPs registered** — UI doesn't gate on "at least one server exists"; Anthropic mcp_servers connector returns empty manifest → LLM responds text-only, confusing for first-time users. Fix: `/dashboard/playground/page.tsx` loads server count on mount, disables "Execute" with inline "Register a server first → /dashboard/servers" CTA when count is 0.

**From Sprint 16 (L.1 follow-up — signup UX fine-tuning):**
- **Email verification 2/h rate limit on built-in Supabase SMTP** — blocks rapid iteration on the signup flow. Hackathon workaround: disable "Confirm email" OR wait out the hour. Pre-demo: configure Resend (or similar) as custom SMTP, which unlocks the editable rate limit + professional verification email template.
- **Vercel preview deployment protection blocks `/auth/callback`** — previews return 401 before our code runs, so the callback handler is only reachable on prod. Acceptable for the hackathon (prod URL is what judges hit), but documenting so future devs don't chase it. Fix: turn off preview protection in Vercel project settings OR add a bypass token for the callback path.
- **Supabase URL-allowlist wildcard for preview domains** — if we re-enable preview testing, add `https://semantic-gps-hackathon-*.vercel.app/auth/callback` to the allowlist. Currently limited to prod + localhost to keep the attack surface small.
- **`/login?error=...` query params aren't rendered** — auth callback handler redirects to `/login?error=missing_code` / `/login?error=exchange_failed` on failure, but `components/(auth)/login/login-form.tsx` doesn't consume the param. Users see stale URL with no feedback. Fix: `useSearchParams()` → `toast.error(errorMap[searchParams.get('error')])`.
- **`custom_access_token_hook` LIMIT 1 arbitrary choice for multi-org users** — V2 multi-tenancy adds multiple memberships per user. Today's `ORDER BY created_at ASC LIMIT 1` picks the oldest. V2 needs an explicit "active org" selection (store in `auth.users.raw_user_meta_data.active_org_id`, or add `memberships.is_active boolean`). Inline `TODO(V2)` comment already in the hook body.

---

## Post-hackathon — V2 + forward-looking vision

Shown to judges who browse deep. Signals that Semantic GPS is thinking past the hackathon window — not demo-only work. Full vision detail in [`VISION.md`](./VISION.md).

### V2 enterprise — multi-tenancy, auth, settings
- **Multi-tenancy — RLS + invite flow (L).** Enable RLS on all app tables (with SECURITY DEFINER helper `public.current_user_orgs()` for gateway service-role path + cross-org manifest lookups by server_id). Widen `memberships.role` enum past `'admin'`. Signed-link invite flow: `public.invites` table + `POST /api/invites` returning JWT link + `/invite?token=` landing + `on_auth_user_created` trigger refactor to consume `raw_user_meta_data.invite_code`. Settings page org-members UI: list + copy-invite-link + remove-member.
- **Email verification + rate-limit on auth endpoints** — Supabase-native for both.
- **Custom policy DSL** — grammar + parser + AST evaluator + syntax-highlight editor. Distinct from NL policy author (which targets existing builtin schemas).
- **Workflow Evaluator benchmark harness** — keyword / embedding / hybrid scoring implementations + golden goal→tool pairs + scoreboard UI. Standalone eval-harness product; distinct from Playground A/B demo surface.
- **Email address change** — Settings > Profile via Supabase `updateUser({ email })` + re-verification.
- **Monitoring widget customization** — `user_dashboard_layouts` table + widget registry + drag/resize.

### V2 hardening — Sprint 5 reviewer follow-ups
Non-blocking at MVP; essential before real multi-tenant traffic.
- `lib/manifest/cache.ts::fetchOrgManifest` pulls ALL `route_steps` — align with `fetchDomainManifest` pattern (cross-tenant leak at V2).
- `lib/policies/built-in.ts::runIpAllowlist` IPv4-only — add IPv6 CIDR matcher.
- `lib/manifest/cache.ts` — extract `fetchByIds<T>` helper; `fetchOrgManifest` + `fetchDomainManifest` exceed 50-line convention.
- `app/api/mcp/domain/[slug]/` + `server/[id]/` — Zod `safeParse` on route params; clean 400 instead of Postgres UUID error.
- `lib/mcp/gateway-handler.ts` — `x-forwarded-for` trusted unconditionally. Safe on Vercel, spoofable self-hosted. Add `TRUSTED_PROXY_ENABLED` flag.
- `lib/mcp/stateless-server.ts::createStatelessServer` at 180 lines — extract request handler blocks.
- `lib/policies/enforce.ts` — retrofit 7 older runners (`pii_redaction`, `rate_limit`, `allowlist`, `injection_guard`, `basic_auth`, `client_id`, `ip_allowlist`) with per-builtin Zod `safeParse` + fail-closed `*_config_invalid` verdicts so DB-stored config can't crash the runner.

### V2 product polish
- **Periodic MCP tool re-discovery (cron)** — sibling of manual rediscover button. Vercel cron / Supabase scheduled function. Matters when users register third-party MCPs.
- **Zod-validate MCP gateway responses in graph page** — `app/dashboard/graph/page.tsx` uses `as { result?: TrelResponse }` without runtime check. Add Zod schema + `safeParse`.
- **SSE multi-event parser** — `lib/mcp/discover-tools.ts` + graph page regex a single `data:` event. Breaks on streamed progressive responses / keepalives.
- **Strip internal error text from API responses** — several routes bubble `{error, details: err.message}`. Replace with `console.error` + opaque `error_code`.
- **SSRF guard DNS-rebinding hardening** — `ssrf-guard.ts` validates DNS on entry but `fetchWithTimeout` re-resolves on the actual request. Pin pre-validated IP into custom `undici.Agent` with fixed `lookup`.
- **ReDoS guard on policy config regex** — `compilePatterns` does `new RegExp(config.patterns[].regex, 'gi')` with no validation. `safe-regex` pre-validate on policy write.
- **Split `playground-workbench.tsx`** (431 lines, over 400 cap) — extract `PaneView` + `applyEvent` reducer + stream-parser into colocated files.
- **`AbortController` on PolicyTimelineChart fetch** — currently uses `cancelled` boolean flag to skip post-unmount setState but doesn't abort in-flight fetch.
- **Sidebar nav badges** — count badges on Servers (tools), Policies (active), Audit (events-last-hour). Needs shared stats fetcher.
- **Cosmetic cleanup** — `button.tsx` semicolons, `sidebar.tsx` + `data-table.tsx` size carve-outs for vendored shadcn, `policy-row.tsx` useMemo when assignments grow past ~20, document `export default` carve-out for Next.js `page.tsx` / `layout.tsx` / `route.ts` in CLAUDE.md.

### Vision gaps — post-hackathon architecture
Full detail in [`VISION.md`](./VISION.md). These are the "built with Sunday's post-hackathon roadmap in mind" signals.

- **Navigation Bundle compile + offline routing** — signed/gzipped graph+policies+semantic-defs bundle; gateway boots from bundle file for air-gapped deployments.
- **A2A protocol bridge** — expose Routes as A2A endpoints in addition to MCP.
- **Simulation Playground / LLM Evaluator** — sandbox agent scored against a Route before deploy.
- **OpenTelemetry distributed tracing** — OTel span per `execute_route` step; env-configured OTLP exporter.
- **Agent Card Designer** — richer semantic rewriting via jsonb templates per tool/route; WYSIWYG editor.
- **Semantic Definition Store** — `semantic_entities` table; tool schemas reference entities instead of inlining.
- **Semantic caching on gateway** — LRU keyed on `hash(goal + manifest_version)`.
- **First-class Rollback Routes** — named reusable compensation chains; `rollback_routes` table + `route_steps.rollback_route_id`.
- **Rust data plane** — port `stateless-server` + policy engine + audit logger; Wasm + native distribution.

<!-- Add deferred features here. Format:
### Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
