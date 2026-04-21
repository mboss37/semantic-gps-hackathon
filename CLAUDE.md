# claude-hackathon

Semantic GPS — MCP control plane for agentic workflows. 5-day hackathon build.

## Hackathon Mission
- **Deadline:** Sunday Apr 26 2026, **8:00 PM EST** — submission via CV platform
- **Deliverables:** 3-min demo video + public GitHub repo (OSS license) + 100–200 word summary
- **Judging weights:** Impact 30 / Demo 25 / Opus 4.7 Use 25 / Depth & Execution 20
- **Side prize to consider:** $5K "Best use of Claude Managed Agents" — worth a look for the demo agent
- Full schedule, resources, and Day-5 submission checklist in `docs/HACKATHON.md`

## Stack
- **Next.js 16** (App Router, Server Components default, Turbopack) + TypeScript strict
- **Supabase** (Postgres + Auth) — local-first dev via `pnpm supabase start`, hosted for prod (`cgvxeurmulnlbevinmzj`)
- **@modelcontextprotocol/sdk** — HTTP-Streamable transport (SSE is deprecated)
- **Zod** for validation, **Radix + Tailwind** for UI, **React Flow** for graph viz
- **Vitest** for tests, **pnpm** for packages, **Vercel** for hosting
- Full stack rationale in `docs/ARCHITECTURE.md`

## Commands
- `pnpm supabase start` — spin up local Docker stack on :54321 (required before dev)
- `pnpm dev` — Next.js on :3000 (Turbopack)
- `pnpm test` — Vitest suite (`__tests__/*.vitest.ts`)
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm supabase db reset` — re-apply all migrations against local DB
- `pnpm supabase db push` — apply pending migrations to hosted (deploy-only; run deliberately)

## Architecture & Scope Docs
These are the source of truth for the build — read them before writing code, and consult them whenever a decision feels ambiguous.

- **`docs/ARCHITECTURE.md`** — operating manual. Stack choices, folder layout, DB schema, API surface, MCP gateway design, security baseline, non-negotiable conventions, hard-won lessons, day-1 checklist, explicit "what not to touch" list.
- **`docs/PROJECT.md`** — pitch & scope. Problem, features, demo scenarios, day-by-day build plan, success criteria, out-of-scope list.
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

## Code Review (pre-commit gate)
Every commit containing `.ts`/`.tsx` changes is **blocked** until:
1. The `code-reviewer` subagent has approved the current staged diff (writes a marker file at `.claude/state/last-review-<hash>`)
2. `pnpm exec tsc --noEmit` passes
3. `pnpm lint` passes
4. `pnpm test` passes

Workflow: stage changes → spawn `code-reviewer` via the Agent tool → fix blockers it flags → re-run reviewer until approved → commit. The hook enforces this; don't try to bypass.

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

## Key Decisions
- **MCP gateway is stateless** — fresh `McpServer` per request; no in-memory session state
- **Shadow vs enforce mode** is a DB column flip — `enforceOrShadow()` wraps every policy check
- **Manifest cache** in `lib/manifest/cache.ts` — invalidate on every mutation
- **Service role Supabase client** used ONLY in the MCP gateway route; user-scoped everywhere else
- **TRel methods** (`discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`) are extra JSON-RPC methods on `/api/mcp` — same auth/policy stack as standard MCP methods
- **Single-org MVP** — RLS off, one user per demo. Multi-tenancy is V2.
- **Demos beat perfect code** — if any of the 4 success criteria breaks on stage, fall back to a recorded clip and ship
