-- Sprint 6 WP-G.6: semantic rewriting layer. Adds optional `display_name` +
-- `display_description` so the MCP gateway can expose Claude-friendly names
-- while the database + `tools/call` dispatch continue to key off the origin
-- `name` (upstream contract stays stable).
--
-- Serialization swap lives in `lib/mcp/stateless-server.ts` on `tools/list`.
-- Tool dispatch (`buildCatalog` + `tools/call`) still uses `name` so routes
-- and real-proxy contracts remain origin-keyed.

alter table public.tools add column if not exists display_name text;
alter table public.tools add column if not exists display_description text;
