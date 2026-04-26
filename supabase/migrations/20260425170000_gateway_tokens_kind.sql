-- Sprint 17 WP-17.2: token consent fix for the Playground.
--
-- Problem: every Playground "Execute" click was INSERTing a fresh row into
-- `gateway_tokens` via `app/api/playground/run/route.ts::mintPlaygroundToken`.
-- Two panes per run × N clicks = `/dashboard/tokens` piles up with noise the
-- user never agreed to create. Tokens are credentials; the user must be the
-- only party who creates rows surfaced in that UI.
--
-- Fix: partition the table by `kind`. User-created tokens keep the existing
-- flow (`kind = 'user'`, plaintext shown once, never persisted). The Playground
-- now reuses a single org-owned internal token (`kind = 'system'`), with its
-- plaintext stashed on the row so later runs can reuse it. System tokens are
-- filtered out of the tokens dashboard + API list, so they never surface as
-- user-visible noise. The user never sees, rotates, or deletes them directly.
--
-- Plaintext-on-row decision (design rationale)
--   - Standard user tokens still follow the hash-only model, plaintext is
--     returned by POST and discarded. `kind='user'` rows must never set
--     `token_plaintext`, enforced by the CHECK below.
--   - System tokens have no user to "show once" to, and must stay reusable
--     across requests/restarts. Storing the plaintext alongside the row keeps
--     a single stable token per org; rotating would re-break the "no new
--     tokens per click" invariant.
--   - Security posture: the service role key can already read any row, the
--     system-token plaintext lives behind the same trust boundary. RLS +
--     explicit `kind='user'` filters on the dashboard loader + API prevent it
--     from ever reaching a user browser.

alter table public.gateway_tokens
  add column kind text not null default 'user'
  check (kind in ('user', 'system'));

-- Populated only for `kind='system'` rows. `null` for user tokens (hash-only,
-- the original behaviour). CHECK enforces the partitioning so no future writer
-- accidentally leaks a user plaintext onto the row.
alter table public.gateway_tokens
  add column token_plaintext text;

alter table public.gateway_tokens
  add constraint gateway_tokens_plaintext_only_for_system check (
    (kind = 'system' and token_plaintext is not null)
    or (kind = 'user' and token_plaintext is null)
  );

-- Helps the Playground's "fetch-or-create" path locate the single system row
-- per org in O(1), and keeps `/dashboard/tokens` selects (filtered to
-- kind='user') fast as the user-token count grows.
create index if not exists idx_gateway_tokens_org_kind
  on public.gateway_tokens (organization_id, kind);

-- Cleanup: drop every row minted by the pre-fix Playground path. The old
-- mint used `name = 'playground-' || time-of-day` (see git blame on
-- `mintPlaygroundToken`), plus the new stable name `'playground-internal'`
-- so a half-migrated state collapses to zero playground rows. User-created
-- tokens (any other name) are untouched.
delete from public.gateway_tokens
where name like 'playground-%' or name = 'playground-internal';
