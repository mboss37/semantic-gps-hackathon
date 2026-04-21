# claude-hackathon — Task Tracker

> Claude: Read at session start. Keep focused — only current state + shipped history matters.
> Completed sprints: keep WPs listed (one line each). Session log: 3 lines max, last 3 sessions.

## Completed Sprints
- **Sprint 1 — Setup:** Next.js 16 + React 19 + Tailwind 4 + ESLint 9 scaffold, core + dev deps, shadcn init (Button), `supabase init`, `.env.example`, vitest smoke test, all quality gates green.

## Current: Sprint 2 — Infra foundation
- [x] **Create hosted Supabase project** — `semantic-gps-hackathon` @ `cgvxeurmulnlbevinmzj`, Central EU (Zurich). **For production only; dev is local.**
- [x] **Generate `CREDENTIALS_ENCRYPTION_KEY`** — AES-256-GCM key via `openssl rand -base64 32`
- [x] **Local Supabase stack up** — `pnpm supabase start` running on `:54321`; emits `sb_publishable_*` / `sb_secret_*` natively
- [x] **Populate `.env.local` with LOCAL values** — written by user; `.env.example` updated to canonical naming
- [x] **Link Supabase CLI to hosted project** — `supabase link --project-ref cgvxeurmulnlbevinmzj` (for eventual deploy only)
- [x] **Prove migration pipeline** — `20260421173113_bootstrap.sql` applied to local (`db reset`) and hosted (`db push`); local+remote match
- [x] **Link Vercel + Supabase Marketplace integration** — deployed at https://semantic-gps-hackathon.vercel.app/ (200 OK); Marketplace auto-injected Supabase trio, manual env vars added (encryption key + Anthropic + app URL)

## Session Log
- 2026-04-21 — Scaffolded docs, Claude Code config, hooks, code-reviewer subagent. License added. Initial repo pushed to `github.com/mboss37/semantic-gps-hackathon`.
- 2026-04-21 — Sprint 1 WP complete: Next.js scaffold + deps + shadcn + supabase + vitest smoke test; all quality gates green.
- 2026-04-21 — Sprint 2 opened: infra foundation (hosted Supabase, env, CLI link, migration pipeline, Vercel + Marketplace integration).
