# Semantic GPS

**The governance gateway between AI agents and the business systems they were never supposed to touch unsupervised.**

AI agents are calling tools in production. MCP is the standard for the connection. But MCP servers ship as "expose every tool, hope for the best": no policies, no audit, no rollback, no workflow discovery. Compliance won't let agents touch production they can't govern. Pilots stay pilots.

Semantic GPS sits between agents and any MCP-connected system as one control plane: 12 hot-swappable policies across 7 governance dimensions, saga rollback with explicit per-step input mapping, audit on every call, a Tool Relationship (TRel) MCP extension for workflow discovery, and a side-by-side Playground proving raw-MCP vs governed contrast under identical Opus 4.7 prompts.

Built for the Anthropic "Keep Thinking" Hackathon (April 2026). 5-day scope.

- **Live demo:** https://semantic-gps-hackathon.vercel.app/
- **Demo video:** _(link added on submission)_
- **Full story:** [`docs/VISION.md`](./docs/VISION.md)

---

## What shipped

- **Vendor-agnostic MCP gateway.** Customers register their own MCP servers via `POST /api/servers` (HTTP-Streamable or OpenAPI). The gateway has zero hardcoded vendor knowledge. The demo recording happens to use a few real upstreams to prove end-to-end correctness; nothing is bundled.
- **12 gateway-native policies** across 7 governance dimensions: time/state gates (`business_hours`, `write_freeze`), rate limiting, identity (`client_id`, `agent_identity_required`), residency (`ip_allowlist`, `geo_fence`), data hygiene (`pii_redaction` with libphonenumber-js, `injection_guard`), kill switches, idempotency.
- **TRel extension methods** on the gateway: `discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`. Same JSON-RPC surface as standard MCP methods.
- **Saga rollback** with canonical per-step `rollback_input_mapping` DSL. Compensators get mapped args, not raw producer results.
- **Playground A/B** at `/dashboard/playground`. Same prompt, same Opus 4.7 client, two endpoints (raw MCP vs governed gateway). Honest variable isolation, no tool-count cheats.
- **Shadow → enforce** policy mode swap, demoed live from the Policies page.
- **Three-tier scoped gateway:** `/api/mcp` (org), `/api/mcp/domain/[slug]`, `/api/mcp/server/[id]`. Bearer-token auth, per-scope manifest caching.

---

## Quickstart (local)

Requires: Node 20+, pnpm 10, Docker (for the local Supabase stack), `openssl` for key generation.

```bash
# 1. Install deps
pnpm install

# 2. Start local Supabase (Postgres + Auth on :54321)
pnpm supabase start

# 3. Wire up .env.local
cp .env.example .env.local
# fill in the local Supabase keys printed by `pnpm supabase start`,
# plus your ANTHROPIC_API_KEY and a freshly generated encryption key:
openssl rand -base64 32   # CREDENTIALS_ENCRYPTION_KEY

# 4. Apply migrations + seed the demo org
pnpm supabase db reset

# 5. (Optional) Load demo data: sample MCPs, tools, saga route, and policies that exercise the gateway end-to-end
docker exec -i supabase_db_semantic-gps-hackathon \
  psql -U postgres -d postgres -f /dev/stdin \
  < scripts/bootstrap-local-demo.sql

# 6. Run the app
pnpm dev
# http://localhost:3000
```

## Environment variables

### Required (local + Vercel)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (local `http://127.0.0.1:54321` or hosted) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (2026 format: `sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Supabase service-role key (gateway-only; `sb_secret_…`) |
| `ANTHROPIC_API_KEY` | Required for the Playground agent loops |
| `PLAYGROUND_MODEL` | Playground model ID (`claude-sonnet-4-6` by default) |
| `EVALUATE_GOAL_MODEL` | TRel `evaluate_goal` ranker (`claude-opus-4-7`) |
| `NEXT_PUBLIC_APP_URL` | Absolute app URL. Set to your Cloudflare tunnel URL when testing the Playground agent against local. |
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM key for `servers.auth_config` ciphertext. Generate with `openssl rand -base64 32` |
| `SF_LOGIN_URL` | Salesforce org base URL for the co-deployed SF MCP route |
| `SF_CLIENT_ID` | SF Connected App client id (Client Credentials flow) |
| `SF_CLIENT_SECRET` | SF Connected App client secret |
| `SLACK_BOT_TOKEN` | Slack bot token (`xoxb-…`); scopes: `chat:write`, `users:read.email`, `channels:read` |
| `GITHUB_PAT` | GitHub classic PAT with `repo` scope (owner/repo come from each tool call, not env) |

### Local-only

| Var | Purpose |
|---|---|
| `SSRF_ALLOW_LOCALHOST=1` | **Set in `.env.local`, leave unset on Vercel.** The gateway's `proxyHttp` roundtrips through `safeFetch` for every upstream including the co-deployed vendor routes. With `origin_url=http://localhost:3000/...` in dev, the SSRF guard would block the hop without this flag. Prod uses the live HTTPS domain so the guard stays tight. |

### Optional runtime flags

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_ENABLE_DEMO_SIMULATORS=1` | Renders the simulator row on the dashboard graph page |
| `REAL_PROXY_ENABLED=0` | Forces the dispatcher's mock canned-data path (default is real upstreams) |
| `MANIFEST_INTROSPECTION_ENABLED=1` | Opens `/api/internal/manifest/invalidate` on prod (dev auto-opens via `NODE_ENV`) |
| `SEMANTIC_GPS_GATEWAY_URL` | Explicit gateway URL for the Playground runner; falls back to `NEXT_PUBLIC_APP_URL` |

### Integration-test flags (vitest only, NOT for Vercel)

The app never reads these at runtime; only vitest suites under `__tests__/` reference them. Set them in your shell when running the gated tests locally. All default to skipped so CI stays fast.

| Var | Purpose |
|---|---|
| `VERIFY_ANTHROPIC=1` | Hits real Anthropic API (needs `ANTHROPIC_API_KEY`) |
| `VERIFY_REAL_PROXY=1` | Runs proxy tests against real upstreams |
| `VERIFY_INTEGRATIONS=1` | Umbrella flag for all live-upstream tests |
| `VERIFY_SALESFORCE=1` | Salesforce live tests (requires `SF_*`) |
| `VERIFY_SLACK=1` | Slack live tests (requires `SLACK_BOT_TOKEN`) |
| `VERIFY_GITHUB=1` | GitHub live tests (requires `GITHUB_PAT`) |
| `VERIFY_GATEWAY_URL` | Base URL for E2E gateway tests (e.g. tunnel URL) |

All runtime env helpers throw loudly on missing values. No silent production fallbacks.

---

## Commands

- `pnpm dev`: Next.js on :3000 (Turbopack)
- `pnpm test`: Vitest suite (`__tests__/*.vitest.ts`), 344 pass / 2 skip
- `pnpm typecheck`: `tsc --noEmit`
- `pnpm lint`: ESLint
- `pnpm supabase start`: local Docker Postgres + Auth
- `pnpm supabase db reset`: re-apply all migrations + seed locally
- `pnpm supabase db push`: apply pending migrations to hosted (deploy-only)

Demo-day recording aides:

- `node scripts/cleanup-demo-data.mjs`: close stale GH issues, prune Slack bot messages, delete recent SF Tasks. Idempotent; run between recording takes.
- `scripts/bootstrap-local-demo.sql`: re-seed the 3-MCP / 12-tool / saga-route / policy demo set after `db reset`.

---

## Architecture at a glance

- **MCP gateway** (`app/api/mcp/**`): stateless `@modelcontextprotocol/sdk` server factory, HTTP-Streamable transport, JSON-RPC 2.0. Fresh `McpServer` per request; no in-memory session state.
- **Manifest cache** (`lib/manifest/cache.ts`): per-scope compiled view of servers / tools / policies / routes. Invalidated on every mutation route.
- **Policy engine** (`lib/policies/**`): 12 builtins, pre-call + post-call phases, shadow/enforce mode is a DB column flip. Fail-closed by convention.
- **Proxy layer** (`lib/mcp/proxy-*.ts`): per-transport dispatchers (openapi, salesforce, slack, github, direct-http). Decrypts `auth_config`, SSRF-guarded fetches, typed `ExecuteResult` union.
- **Routes + sagas** (`lib/mcp/execute-route.ts`): ordered step execution, explicit `input_mapping` + `rollback_input_mapping` DSLs, compensated_by traversal on halt, shared traceId audit chain.

Full stack reference in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
Sprint-by-sprint build log in [`TASKS.md`](./TASKS.md).
Roadmap and post-hackathon vision in [`docs/VISION.md`](./docs/VISION.md).

---

## License

MIT. See [`LICENSE`](./LICENSE).

## Credits

Built by [@mboss37](https://github.com/mboss37). Claude Opus 4.7 1M-context used throughout the build loop.
