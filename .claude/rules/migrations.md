---
paths: ["supabase/migrations/**"]
---

# Supabase Migration Rules

## Filename format
- **14-digit `YYYYMMDDHHMMSS_descriptive_name.sql`** — Supabase CLI's only recognized format
- Descriptive name is kebab-case or snake_case (`add_org_scope`, not `AddOrgScope`)
- Hyphenated prefixes like `20260424-02_foo.sql` are **silently skipped** by the CLI — they never apply to local or hosted, and `supabase db reset` won't warn
- One migration per file, idempotent where possible (`drop constraint if exists`, `insert ... where not exists`)

## Hosted migrations
- `pnpm supabase db push` is the **only** way to apply migrations to hosted
- **Never** use Supabase MCP `apply_migration` against hosted
- **Never** manually INSERT into `supabase_migrations.schema_migrations` to paper over drift

## Why `apply_migration` is banned
- MCP `apply_migration` stamps `schema_migrations.version` with `now()` at apply time, **not** the filename timestamp
- Local `supabase db push` uses the 14-digit filename prefix as `version`
- Mixing the two → `local.version != remote.version` for the same migration → `supabase db push` refuses to run until manually reconciled (UPDATE-ing `schema_migrations` by hand)
- Clean hosted state requires a single source of truth: the filename timestamp

## Canonical flow
1. Write migration file under `supabase/migrations/` with 14-digit timestamp prefix
2. `pnpm supabase db reset` — re-applies everything cleanly against local
3. Test locally: run affected routes, policies, seeds
4. Only when local is green: `pnpm supabase db push` to hosted

## Verification
- After any push: `pnpm supabase migration list --linked`
- Local and Remote columns must match exactly, row-for-row
- If they don't: stop, reconcile (usually by UPDATE on hosted `schema_migrations.version`), then re-verify before moving on

## Sprint wrap
- **Before closing any sprint that touched `supabase/migrations/`, run `pnpm supabase migration list --linked` and verify Local == Remote row-for-row.** If any local entry is missing on remote → `pnpm supabase db push` before writing the wrap commit.
- Sprint 17 → 18 drift cost a user-visible bug: migration 22 (`gateway_tokens_kind`) committed to `main` + applied locally, never pushed to hosted → Sprint 18.3 deploy-test token-mint surfaced it as a generic "create failed" toast. See Hard-Won Lesson #32.
- Rule of thumb: if the sprint added a `YYYYMMDDHHMMSS_*.sql` file, `db push` is part of the wrap, not a later deploy task.

## Related
- `CLAUDE.md` § Off-Limits — banned operations at a glance
- `docs/ARCHITECTURE.md` § Migration workflow — narrative version with the drift mechanism explained
