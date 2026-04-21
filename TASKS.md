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

## Current: Sprint 3 — Core build (spine + gateway + policy swap hero)
Effort estimates are AI wall-clock (~8x faster than human hours). Hard gate: WP-3.2 gateway must be MCP-Inspector-verifiable against Vercel before WP-3.3 starts.

- [ ] **3.1 Spine libs + core schema** (~1h) — migration for 6 tables (servers/tools/relationships/policies/policy_assignments/mcp_events); `lib/supabase/{server,client,service}.ts`; `lib/auth.ts` (`requireAuth()`); `proxy.ts` (NOT middleware.ts); `lib/security/ssrf-guard.ts` (RFC1918 + 127/8 + 169.254/16); `lib/crypto/encrypt.ts` AES-256-GCM + round-trip test; `lib/audit/logger.ts` (`logMCPEvent` + `redactPayload`); `lib/manifest/cache.ts` (`loadManifest` + `invalidateManifest`); single SQL-seeded user with auto-login
- [ ] **3.2 MCP gateway skeleton — Inspector-verified** (~45min) — `app/api/mcp/route.ts` answers `initialize` / `tools/list` / `tools/call` for a hardcoded `echo` tool; verified by `npx @modelcontextprotocol/inspector` against `https://semantic-gps-hackathon.vercel.app/api/mcp` AND a local `@anthropic-ai/sdk` script. Deploy before 3.3 starts.
- [ ] **3.3 OpenAPI import + servers CRUD** (~45min) — commit branded API snapshot to `/public/demo-openapi.json`; converter `lib/openapi/to-tools.ts` (+ 3 unit tests); `/api/openapi-import` (Zod + `safeFetch` + `invalidateManifest`); `/api/servers` GET/DELETE; TRel `discover_relationships` + BFS-based `find_workflow_path` implementations
- [ ] **3.4 Policy engine + enforce/shadow + toggle route** (~45min) — `lib/policies/built-in.ts` implements `pii_redaction` (primary, on-camera) + `allowlist` (secondary); `enforceOrShadow()` wired into `tools/call`; `/api/policies` CRUD + assignments; `enforceOrShadow.vitest.ts` covers shadow-logs-but-passes + enforce-blocks paths; every mutation route calls `invalidateManifest()`
- [ ] **3.5 Dashboard — 4 pages + primitives** (~1.25h) — add shadcn primitives (Dialog, Card, Input, Select, Textarea, Tabs, Sonner toast, Badge); `/dashboard` shell with auth; servers page (list + import dialog + delete); graph page (React Flow from `discover_relationships`, 8 edge-type legend, click-node-for-details); policies page (JSON config + shadow/enforce toggle); audit page (paginated list + trace_id filter + 1s polling + one Recharts bar)
- [ ] **3.6 Seed + embedded demo agent** (~45min) — `scripts/seed-demo.ts` (2 servers, 6–8 tools, 4–6 relationships covering 4 edge types, 2 policies); embedded "Try it" agent panel in dashboard (Opus 4.7, prompt caching on tools list, scripted prompts for PII policy swap scenario)

**Locked scope decisions** (see `BACKLOG.md` for stretches):
- Hero demo = PII-redaction live-policy-swap (allowlist as secondary)
- Demo agent = embedded panel, not standalone script
- OpenAPI source = branded snapshot in `/public/demo-openapi.json`
- Managed Agents = default cut; re-evaluate Thu after Cohen session
- Relationship inference via Opus, NL policy author, extended-thinking UI, `validate_workflow`, rate-limit/injection-guard = all stretch (BACKLOG)

**Hard cuts** (NOT in Sprint 3 or BACKLOG):
- `evaluate_goal` TRel method
- Fallback routing / retry logic
- Session replay UI (audit trace_id filter covers it)
- Supabase realtime (1s polling instead)
- Signup page (SQL-seeded user)

## Session Log
- 2026-04-21 — Sprint 1 WP complete: Next.js scaffold + deps + shadcn + supabase + vitest smoke test; all quality gates green.
- 2026-04-21 — Sprint 2 opened: infra foundation (hosted Supabase, env, CLI link, migration pipeline, Vercel + Marketplace integration).
- 2026-04-21 — Sprint 2 wrapped: 7 WPs shipped, 5 memories harvested (local-first, key parity, port conflict, env deny narrowing, early-infra pattern), ARCHITECTURE + CLAUDE docs updated.
