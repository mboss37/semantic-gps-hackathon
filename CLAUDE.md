# claude-hackathon

Semantic GPS — MCP control plane for agentic workflows. 5-day hackathon build.

## Hackathon Mission
- **Deadline:** Sunday Apr 26 2026, **8:00 PM EST** = **Mon Apr 27 02:00 CET** — submission via CV platform
- **Builder TZ:** Mihael is in **CET (UTC+2)**. Practical build cutoff is **Sat Apr 25 EOD CET**; Sun is recording + upload + contingency only.
- **Deliverables:** 3-min demo video + public GitHub repo (OSS license) + 100–200 word summary
- **Judging weights:** Impact 30 / Demo 25 / Opus 4.7 Use 25 / Depth & Execution 20
- **Side prize to consider:** $5K "Best use of Claude Managed Agents" — worth a look for the demo agent
- **Binding constraints are review bandwidth + regression risk, NOT Claude dev-hours.** A sprint's worth of WPs ships in wall-clock minutes; each WP still takes one human review + subagent review + approval cycle. Plan against "max 2 big stretches Fri+Sat," not "how long to code it."
- Full schedule, reverse-planned build calendar, resources, and Day-5 submission checklist in `docs/HACKATHON.md`

## Competition Mindset (hard rules during the hackathon window)

**Stakes:** ~500 submissions. Top 3 get prize money. A $5K side prize for Managed Agents. Every unshipped piece of polish is a ranking slot lost. This is a competition, not a homework project. Act accordingly.

### 1. Judging signal order
Judges see, in this order: **landing page → demo video → dashboard → code.** Every choice optimizes for the first unseen. Code quality (20% Depth) is last-mile; the other 80% (Impact 30 + Demo 25 + Opus 4.7 Use 25) is what judges SEE. Do not over-invest in depth while the front door looks like a hello world.

### 2. Visual polish is not optional
A page or feature without a screenshot in the README, a video beat, or a demo clip **does not exist for judging purposes.** Flag missing visual artifacts the same way we flag missing tests. If a WP ships without a demo-visible beat, it's incomplete — not done.

### 3. First-impression rule
The landing page is the tasting menu. It must communicate WHAT, WHY, and WHO in 3 seconds without scrolling. Text-only hero = automatic downgrade. Required minimum for any user-facing entry point (landing, README, dashboard overview): hero screenshot or video loop, plain-English subhead (no jargon stacks), loud primary CTA in brand color (not muted grey), architecture diagram or stat badges below the fold.

### 4. Proactive critic mandate
When Mihael shares any user-visible artifact — landing page, README, demo script, dashboard screen, Playground preset, vision doc — **critique it unprompted.** Do not wait for "is this good?" Flag weak CTAs, missing screenshots, jargon subheads, dead-end buttons, boilerplate residue, CNA leftovers, placeholder text, generic icons, muted-grey buttons, black-void heroes. On sight. With a fix proposed.

### 5. Anti-patterns that auto-downgrade rank
Flag and fix immediately, never ship with these:
- Black-void hero with text only (no screenshot / video / diagram)
- Grey or low-contrast primary CTA
- Next.js `N` logo in the corner (unmistakable boilerplate fingerprint)
- README that reads like a spec, not a pitch
- Missing embedded demo clip above the fold
- Missing architecture diagram anywhere visible
- Signup that drops users into an empty dashboard with zero onboarding
- Jargon subheads ("control plane for MCP agents" — what does this MEAN to a judge who doesn't know MCP?)
- Placeholder copy, dead links, lorem-ipsum anywhere user-visible

### 6. Ship polish like a startup, not homework
Hackathon quality ≠ homework quality. Add logos, motion, gradients, animated demos, screenshot captures with annotations, GIFs of the saga rollback cascade, short Loom thumbnails. Stress-test the landing against top-rated Product Hunt launches of the week. If it looks like a student project, it ranks like one.

### 7. Rank-conscious proposals
When proposing a sprint, a WP, or a change, name the ranking slot it moves. "This lifts us from ~300/500 to ~100/500 because judges now see the saga rollback in motion" > "this adds a GIF to the README." Tie every piece of work to a judging-weight signal or a first-impression beat — or kill it.

## Stack
- **Next.js 16** (App Router, Server Components default, Turbopack) + TypeScript strict
- **Supabase** (Postgres + Auth) — local-first dev via `pnpm supabase start`, hosted for prod (`cgvxeurmulnlbevinmzj`)
- **@modelcontextprotocol/sdk** — HTTP-Streamable transport (SSE is deprecated)
- **Zod** for validation, **Radix + Tailwind** for UI, **React Flow** for graph viz
- **libphonenumber-js** for PII phone parsing (`lib/policies/runners/pii-redaction.ts`) — handles US parens + international + E.164 with numbering-plan validation
- **Vitest** for tests, **pnpm** for packages, **Vercel** for hosting
- Full stack rationale in `docs/ARCHITECTURE.md`

## Commands
- `pnpm supabase start` — spin up local Docker stack on :54321 (required before dev)
- `pnpm dev` — Next.js on :3000 (Turbopack)
- `pnpm test` — Vitest suite (`__tests__/*.vitest.ts`)
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm supabase db reset` — re-apply all migrations against local DB
- `pnpm supabase db push` — **canonical** hosted-migration command (deploy-only; run deliberately). Never use MCP `apply_migration` as a substitute — see `.claude/rules/migrations.md`
- `pnpm supabase migration list --linked` — verify parity; Local column must equal Remote column, row-for-row

## Architecture & Scope Docs
These are the source of truth for the build — read them before writing code, and consult them whenever a decision feels ambiguous.

- **`docs/ARCHITECTURE.md`** — operating manual. Stack choices, folder layout, DB schema, API surface, MCP gateway design, security baseline, non-negotiable conventions, hard-won lessons, day-1 checklist, explicit "what not to touch" list.
- **`docs/PROJECT.md`** — pitch & scope. Problem, features, demo scenarios, day-by-day build plan, success criteria, out-of-scope list.
- **`docs/USER-STORIES.md`** — locked user-story spec. Canonical relationship taxonomy, V2 cut-lines, Playground A/B hero narrative. Sprint scope must trace back to a story here.
- **`BACKLOG.md`** — deferred features. Add here immediately when something is discussed but not in this sprint.
- **`TASKS.md`** — current sprint + session log. Update as work lands.

If `docs/ARCHITECTURE.md` and this file ever disagree, architecture wins — open a PR to reconcile.

## Session Start
- ALWAYS read `TASKS.md` first — tracks progress across sessions
- Check Session Log at bottom for where we left off
- Update `TASKS.md` as you complete work
- Search agentic-memory (`memory_search`) before re-deriving project patterns

## Backlog
- When a feature is discussed but deferred, add it to `BACKLOG.md` immediately
- Never leave future ideas only in `TASKS.md` or conversation — they get lost
- `BACKLOG.md` is the single source of truth for parked features
- **When a WP is pulled from `BACKLOG.md` into a sprint, remove it from `BACKLOG.md` in the same edit.** Backlog is parked work only; active/completed work lives in `TASKS.md`.
- If a sprint WP gets cancelled mid-sprint (not completed), return it to `BACKLOG.md` with updated notes.

## Sprints
- Sweet spot: 3-6 work packages per sprint. Not 10+ (chaos), not 1-2 (microsprint).
- On sprint start, pull items from `BACKLOG.md` — a hook warns if the current sprint is over/under sized.
- When all tasks complete, commit via the review flow below.
- **Completed sprints persist in `TASKS.md` with their WPs listed (one line each), not collapsed to a single-line summary.** Historical record of what shipped matters.

## Work Packages — Plan First (hard rule)
Every WP starts with a plan, NOT with code. No exceptions, even for "obviously small" WPs. Plans take 2–3 minutes and catch demo-killing bugs before they land (see the CC-regex UUID false-positive in WP-3.4 — the kind of thing a plan review surfaces for free).

On WP kickoff, before any `Write`/`Edit`:
1. Read the relevant spec: `docs/ARCHITECTURE.md`, `docs/PROJECT.md`, active rules in `.claude/rules/*.md`, the WP line in `TASKS.md`.
2. Sanity-check SDK / API assumptions — skim installed type defs, `context7` for framework docs, grep the existing codebase for the pattern.
3. Present the plan via `ExitPlanMode` (or a clearly-framed plan message when plan mode isn't available). Must include:
   - Files to create/modify (with one-line intent each)
   - Key design decisions (schema shapes, algorithm choice, error paths)
   - Test coverage plan (what cases, which vitest file)
   - Cut / stretch line items (what's explicitly NOT in this WP)
   - Risk flags (SDK version pitfalls, edge cases, perf concerns)
4. **Wait for explicit user approval.** Silence is not approval. Auto mode is not blanket approval.
5. Only then execute. Deviation from the approved plan needs a check-in, not a fait accompli.

Rule applies equally to WP kickoff, WP resumption after a pause, and pulling a fresh WP mid-sprint. If a plan was approved yesterday and the WP resumes today, a 30-second "here's what I'm about to do — confirm still good?" counts as the plan re-check.

No plan → no code. Not a heuristic — the rule.

## Code Review (pre-commit gate)
Every commit containing `.ts`/`.tsx` changes is **blocked** until:
1. A fresh review marker exists at `.claude/state/last-review-<staged-diff-hash>`
2. `pnpm exec tsc --noEmit` passes
3. `pnpm lint` passes
4. `pnpm test` passes — **every applicable headless test must actually run, not just default skips.** If the diff touches code gated behind opt-in vitest flags (e.g. `VERIFY_REAL_PROXY=1`, `VERIFY_ANTHROPIC=1`, `VERIFY_INTEGRATIONS=1`), run those too. If the diff changes routes/pages, run `pnpm exec next build` and curl the changed endpoint. If the diff changes DB schema, run `pnpm supabase db reset` locally and confirm the migration applies clean.
5. `pnpm exec next build` passes when the diff touches `app/`, `proxy.ts`, or Next.js config (catches Suspense / useSearchParams / generateStaticParams issues that `tsc` + `test` miss)

Workflow — **subagent reviews, human approves, main session writes marker.** This keeps the human in the loop between reviewer findings and the commit gate flipping green.

1. Stage changes (`git add <scope>`).
2. Spawn `code-reviewer` via the Agent tool. Prompt it to output blocking issues + suggestions + verdict, and **explicitly instruct it NOT to write the marker file**.
3. Main session relays the reviewer's findings verbatim to the user.
4. User responds with "approved" (or specific fixes to apply).
5. On approval, main session writes the marker itself: `mkdir -p .claude/state && touch .claude/state/last-review-<hash>` where `<hash>` is the first 16 hex chars of `git diff --staged | sha1sum`.
6. Commit. Hook verifies marker + runs gates.

If the reviewer flags blockers, fix them, re-stage, and loop from step 2 — the marker is only written once the user approves the final diff.

**Why this shape:** a subagent writing approval markers trips the tooling's security detector (it can't distinguish a legitimate code-reviewer approval from a bypass attempt). Keeping marker writes in the main session after explicit human acknowledgment eliminates the false positives without weakening the gate.

## Conventions
- TypeScript strict — no `any`, no `@ts-ignore`, no `as any`, no `!` non-null assertions
- Zod `.safeParse()` in route handlers — never `.parse()` (crashes server on bad input)
- Supabase `auth.getUser()` — never `getSession()` (spoofable)
- Next.js 16 uses `proxy.ts`, **not** `middleware.ts` (build fails if both exist)
- `export const dynamic = 'force-dynamic'` on GET handlers returning user-specific data
- Files under 400 lines, functions under 50 lines
- Named exports, early returns, kebab-case directories, PascalCase component files
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

## Memory (agentic-memory)
- Search before storing — `memory_search` to avoid duplicates
- Store decisions, gotchas, and non-obvious patterns — capture WHY, not WHAT
- Update existing memories instead of creating new ones
- Never store secrets, API keys, or encryption material
- Session context is auto-injected — don't call `memory_recent` manually

## Parallel Work
When multiple work packages in a sprint are independent, run them in parallel — one Agent call per package, **all in a single assistant message** so they execute concurrently. Never serialize what can parallelize; hackathon time is the binding constraint, not context.

Pick the right subagent type:
- `Explore` — read-only codebase search
- `Plan` — architecture / strategy decisions
- `general-purpose` — multi-step tasks (research, implement, test, etc.)
- `code-reviewer` — pre-commit review (required for commits)

Good triggers: "implement feature A while researching feature B", "build the UI while I wire the API", "check three different parts of the codebase at once". Bad trigger: sequential dependencies (A must finish before B reads its output).

### Worktree isolation is MANDATORY for any write-capable subagent
Sprint 17 shipped one class of bug we never accept again: a sibling subagent's `git stash` + `git checkout -- <paths>` wiped another subagent's already-shipped files, because both were editing the same working tree in parallel. Fix is platform-level, not social.

Rules:
1. **Any subagent that may write files runs in a dedicated git worktree.** `.claude/agents/general-purpose.md` sets `isolation: worktree` in frontmatter so every spawn of `general-purpose` (the default write-capable subagent) inherits this automatically. When spawning ad-hoc or a non-default type that can write, pass `isolation: "worktree"` explicitly.
2. **Read-only subagents don't need a worktree** — `Explore`, `Plan`, `claude-code-guide`, research agents. They pay nothing for a shared tree because they make no diff.
3. **`code-reviewer` must NOT run in a worktree.** It reads the main session's staged diff (`git diff --cached`). A worktree would be empty of your staged changes and the review would pass on no content.
4. **Inside any worktree subagent: `git stash`, `git checkout -- <paths>`, `git restore <paths>`, `git reset --hard`, `git commit`, `git push` are all banned.** Every recovery path is "fix forward" inside the worktree.
5. **Commits happen in the main session after worktree merge-back.** Subagents report what they changed; main session stages + runs code-reviewer + writes the marker + commits.

If you catch yourself about to launch a `general-purpose` agent without worktree isolation (or an ad-hoc Agent call that writes files without `isolation: "worktree"`), stop and fix the config first. Don't cross fingers.

### Merge contract — worktree subagents do NOT auto-merge
Per [Anthropic's Common Workflows docs](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees), every worktree subagent creates a branch at `.claude/worktrees/<name>` off `origin/HEAD`. On completion:
- No changes → worktree + branch auto-deleted.
- Changes present → worktree + branch persist, **waiting for main session to merge**.

Main session flow after parallel subagents return:
1. `git worktree list` — see surviving worktrees.
2. For each, inspect the branch: `git log main..worktree-<name>`, `git diff main worktree-<name>`.
3. Merge in dependency order: `git merge worktree-<name>` per subagent. Fix conflicts inline — conflicts are information, not failures; they point to task-boundary leakage.
4. After all merges land cleanly and tests pass: `git worktree remove .claude/worktrees/<name>` + `git branch -D worktree-<name>`.
5. `git worktree prune` as a final sweep.
6. Stale worktrees older than 7 days auto-cleanup via `cleanupPeriodDays: 7` in `.claude/settings.json`.

Implication for WP design: **each parallel WP must own a disjoint set of files** — overlapping files guarantees merge conflicts and (worse) silent clobber on resolution. Main session owns boundary-drawing before spawning.

### Worktree env-var copy
Worktrees are fresh checkouts — gitignored files (`.env.local`, etc.) do NOT copy over by default. `.worktreeinclude` at the repo root lists the exact gitignored files that should be copied into every subagent worktree so `pnpm supabase`, `pnpm dev`, and integration tests work inside the isolated checkout. If a subagent fails because a secret is missing, extend `.worktreeinclude` — don't commit the secret.

## Stop-and-Swarm
Three failed iterations on the same problem = stop iterating alone.
On the fourth attempt, spin up at least 3 parallel agents via the Agent tool, each investigating from a different angle:
1. Root-cause debug agent
2. Upstream library/docs research agent (prefer `context7` for MCP SDK, Next.js 16, Supabase)
3. Alternative architecture agent

Wait for all agents to return, synthesize their findings, then act.

## Off-Limits
- Never hardcode secrets — use `process.env.*` (even in tests: `process.env.X ?? ''`)
- Never write to `.env` files (hook-blocked)
- Never expose internal error details in API responses — use typed error codes
- Never proxy an outbound fetch without routing through `lib/security/ssrf-guard.ts`
- Never store credentials in Postgres unencrypted — all `servers.auth_config` passes through `lib/crypto/encrypt.ts` (AES-256-GCM)
- Never use SSE MCP transport — deprecated, HTTP-Streamable only
- Never skip `invalidateManifest()` after mutating servers/tools/policies/relationships
- Never log raw MCP payloads — use `redactPayload()` first
- Never add scope from the "What Not To Touch" list in `docs/ARCHITECTURE.md` (RLS, SSO, i18n, etc.)
- **Never develop against the hosted Supabase project.** Local dev uses `pnpm supabase start` (Docker stack) — `.env.local` gets local URLs + local keys. The hosted project is production. Migration workflow is **apply to local, iterate, `supabase db reset` freely, push to hosted only before the first real deploy.** Proposing hosted creds for local dev is an anti-pattern — do not repeat it.
- **Always seed local first, test + validate locally, THEN mirror to hosted.** Hard rule, no exceptions. The correct flow for any demo data (servers, tools, relationships, routes, policies, fixtures):
  1. Apply the idempotent seed SQL to **local** via `docker exec supabase_db_semantic-gps-hackathon psql -U postgres -d postgres -f <file>` (or equivalent).
  2. Validate end-to-end against the **local** gateway (`http://localhost:3000/api/mcp`) + local Supabase. Every demo story must PASS locally before touching hosted.
  3. Only after local is green, mirror the same SQL to hosted via Supabase MCP `execute_sql`.
  4. **Never** test a demo beat against hosted first — "it works on prod, let's check local later" is the anti-pattern.
- **`pnpm supabase db reset` wipes all data-plane seeds.** `supabase/seed.sql` is the ONLY thing that auto-re-runs (demo user, org, gateway token). Anything loaded via `docker exec psql -f` or Supabase MCP outside seed.sql is gone after a reset. After any `db reset`, immediately re-run every demo-data seed script (SF/Slack/GH registration, policies, routes) against the fresh local DB before testing anything. Better: fold recurring demo seeds into `supabase/seed.sql` so they're local-reset-durable.
- **Local must be a full superset of hosted demo state at all times.** If hosted has 3 MCPs + 12 tools + 5 policies registered, local has the same — or strictly more — before any new work starts. An empty local while hosted is populated is always a bug, not a setup choice.
- **Never run MCP `apply_migration` against hosted Supabase.** It timestamps `schema_migrations.version` with `now()` instead of the filename, causing local↔hosted drift. Use `pnpm supabase db push` exclusively. See `.claude/rules/migrations.md`.
- **Migration filenames must be 14-digit `YYYYMMDDHHMMSS_*.sql`.** Anything else (e.g. `20260424-02_foo.sql`) is silently skipped by the Supabase CLI — it never applies locally or hosted, and `db reset` won't warn.

## Key Decisions
- **MCP gateway is stateless** — fresh `McpServer` per request; no in-memory session state
- **Shadow vs enforce mode** is a DB column flip — `enforceOrShadow()` wraps every policy check
- **Manifest cache** in `lib/manifest/cache.ts` — invalidate on every mutation
- **Service role Supabase client** used ONLY in the MCP gateway route; user-scoped everywhere else
- **TRel methods** (`discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`) are extra JSON-RPC methods on `/api/mcp` — same auth/policy stack as standard MCP methods
- **Multi-tenant-ready schema with single-admin MVP** — `organizations` + `memberships` exist; `memberships.role` CHECK locked to `'admin'` only. First signup auto-creates org + membership + default SalesOps domain via `on_auth_user_created` trigger. V2 expands role enum beyond `admin`.
- **RLS via JWT claim hook** — `custom_access_token_hook` stamps `organization_id` into the JWT on every access token issuance (login + refresh). RLS policies on all 13 tenant tables evaluate `organization_id = public.jwt_org_id()` — zero DB lookup per row, tamper-proof. Service-role key bypasses RLS so the MCP gateway + audit logger + manifest cache path keeps working. App-layer `.eq('organization_id', ...)` filters remain as belt-and-braces. Shipped Sprint 16 WP-L.1. Hook registration is NOT migratable — local via `supabase/config.toml`, hosted via dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims hook".
- **Real-proxy default-on** — `lib/mcp/proxy-openapi.ts` and `lib/mcp/proxy-http.ts` dispatch via `executeTool()` by default; `REAL_PROXY_ENABLED=0` forces the mock fallback for dev determinism. Production on Vercel routes to real upstreams without extra config. Shipped Sprint 5 WP-C.3.
- **Three-tier scoped gateway** — `/api/mcp` (org) + `/api/mcp/domain/[slug]` + `/api/mcp/server/[id]`. Shared `buildGatewayHandler(scopeResolver)`. Per-scope manifest cache keyed on a `ManifestScope` discriminated union. Unknown slug/id → empty manifest (no crash). Shipped Sprint 5 WP-D.1.
- **Multi-tenancy enforced at DB + app layer** — RLS on every tenant table (Sprint 16 L.1) + app-layer `.eq('organization_id', ...)` filters in every reader/writer (Sprint 15 multi-tenancy sweep). Cross-org UUID guess returns empty at both layers. Single-admin MVP: `memberships.role` CHECK locked to `admin|member`; one membership per user assumed by `custom_access_token_hook::LIMIT 1`.
- **Gateway-native policy taxonomy** — Semantic GPS governs the CALL (time/rate/identity/residency/hygiene/kill-switches/idempotency), never the DATA. Shipped 12 builtins across those dimensions through Sprint 10. Approval workflows, transaction integrity, RBAC on records, cost budgets, business rules, field validation = downstream systems' territory (Salesforce Approval Processes / SAP Workflow / agent frameworks / LLM provider dashboards) — not ours. Rule: if agent frameworks or downstream systems have better visibility into the thing, it's not our policy. Cemented Sprint 9 after rejecting `budget_cap`.
- **Saga rollback is explicit per-step input mapping, not result-passthrough** — compensator schemas rarely match producer output shapes (`create_issue.result {number}` ≠ `close_issue.args {issue_number, owner, repo}`). `route_steps.rollback_input_mapping jsonb` uses the same DSL as `input_mapping`. CapturedStep bag stores `{args, result}` per step so mappings can reference either namespace via `$steps.<key>.args.<path>` or `$steps.<key>.result.<path>`; bare `$steps.<key>.<path>` auto-prefixes `.result.` for backwards compat. Canonical saga pattern from Sprint 10.
- **Playground runs with extended thinking on both panes** — `thinking: { type: 'enabled', budget_tokens: 2048 }`, `max_tokens: 8192`, enabled on both raw and gateway panes. Honest-A/B principle extends to model capabilities, not just tools: governance is the variable, reasoning capacity is not. Shipped Sprint 12 WP-12.1.
- **Subagent worktree isolation is mandatory for write-capable agents** — `.claude/agents/general-purpose.md` sets `isolation: worktree` in frontmatter so every spawn gets a dedicated git worktree. Parallel subagents sharing one tree will clobber each other via `git stash` / `git checkout -- <paths>` collisions (Sprint 17 lived through it). Read-only agents (Explore, Plan, research) stay shared-tree; `code-reviewer` also stays shared-tree because it needs `git diff --cached` visibility. Worktrees don't auto-merge — main session runs `git merge worktree-<name>` per subagent after return. `.worktreeinclude` copies `.env.local` into each worktree. Shipped Sprint 17 in d852859.
- **Demos beat perfect code** — if any of the 4 success criteria breaks on stage, fall back to a recorded clip and ship
