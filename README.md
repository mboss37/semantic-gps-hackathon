# Semantic GPS

**The control plane for MCP agents: live policy enforcement, typed workflow discovery, and audit — all through one gateway.**

Built for the Anthropic "Keep Thinking" Hackathon (April 2026) — 5-day scope, production-grade wedge.

- **Live demo:** https://semantic-gps-hackathon.vercel.app/
- **Demo video:** _(link added on submission)_
- **Vision beyond the wedge:** [`VISION.md`](./VISION.md) — split control/data plane, Rust data plane deploy-anywhere, multi-region Next.js control plane.

---

## What shipped

- **3 real MCP integrations** — Salesforce (OAuth Client Credentials), Slack (Bot API), GitHub (PAT). 12 curated tools across the three servers.
- **12 gateway-native policies** across 7 governance dimensions: time/state gates (`business_hours`, `write_freeze`), rate limiting, identity (`client_id`, `agent_identity_required`), residency (`ip_allowlist`, `geo_fence`), data hygiene (`pii_redaction` with libphonenumber-js, `injection_guard`), kill switches, idempotency.
- **TRel extension methods** on the gateway — `discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`. Same JSON-RPC surface as standard MCP methods.
- **Saga rollback** with canonical per-step `rollback_input_mapping` DSL. Compensators get mapped args, not raw producer results.
- **Playground A/B** at `/dashboard/playground` — same prompt, same Opus 4.7 client, two endpoints (raw MCP vs governed gateway). Honest variable isolation, no tool-count cheats.
- **Shadow → enforce** policy mode swap, demoed live from the Policies page.
- **Three-tier scoped gateway** — `/api/mcp` (org), `/api/mcp/domain/[slug]`, `/api/mcp/server/[id]`. Bearer-token auth, per-scope manifest caching.

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
openssl rand -base64 32   # → CREDENTIALS_ENCRYPTION_KEY

# 4. Apply migrations + seed the demo org
pnpm supabase db reset

# 5. (Optional) Load the full demo data into local — 3 MCPs, 12 tools, saga route, policies
docker exec -i supabase_db_semantic-gps-hackathon \
  psql -U postgres -d postgres -f /dev/stdin \
  < scripts/bootstrap-local-demo.sql

# 6. Run the app
pnpm dev
# → http://localhost:3000
```

## Environment variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (local `http://127.0.0.1:54321` or hosted) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (2026 format: `sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Supabase service-role key (gateway-only; `sb_secret_…`) |
| `ANTHROPIC_API_KEY` | Required for the Playground agent loops |
| `PLAYGROUND_MODEL` | Playground model ID (`claude-sonnet-4-6` by default) |
| `EVALUATE_GOAL_MODEL` | TRel `evaluate_goal` ranker (`claude-opus-4-7`) |
| `NEXT_PUBLIC_APP_URL` | Absolute app URL — set to your Cloudflare tunnel URL when testing the Playground agent against local |
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM key for `servers.auth_config` ciphertext. Generate with `openssl rand -base64 32` |

All env helpers throw loudly on missing values — no silent production fallbacks.

---

## Commands

- `pnpm dev` — Next.js on :3000 (Turbopack)
- `pnpm test` — Vitest suite (`__tests__/*.vitest.ts`), 256 pass / 5 skip
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — ESLint
- `pnpm supabase start` — local Docker Postgres + Auth
- `pnpm supabase db reset` — re-apply all migrations + seed locally
- `pnpm supabase db push` — apply pending migrations to hosted (deploy-only)

Demo-day recording aides:

- `node scripts/cleanup-demo-data.mjs` — close stale GH issues, prune Slack bot messages, delete recent SF Tasks. Idempotent; run between recording takes.
- `scripts/bootstrap-local-demo.sql` — re-seed the 3-MCP / 12-tool / saga-route / policy demo set after `db reset`.

---

## Architecture at a glance

- **MCP gateway** (`app/api/mcp/**`) — stateless `@modelcontextprotocol/sdk` server factory, HTTP-Streamable transport, JSON-RPC 2.0. Fresh `McpServer` per request; no in-memory session state.
- **Manifest cache** (`lib/manifest/cache.ts`) — per-scope compiled view of servers / tools / policies / routes. Invalidated on every mutation route.
- **Policy engine** (`lib/policies/**`) — 12 builtins, pre-call + post-call phases, shadow/enforce mode is a DB column flip. Fail-closed by convention.
- **Proxy layer** (`lib/mcp/proxy-*.ts`) — per-transport dispatchers (openapi, salesforce, slack, github, direct-http). Decrypts `auth_config`, SSRF-guarded fetches, typed `ExecuteResult` union.
- **Routes + sagas** (`lib/mcp/execute-route.ts`) — ordered step execution, explicit `input_mapping` + `rollback_input_mapping` DSLs, compensated_by traversal on halt, shared traceId audit chain.

Full stack reference in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
Sprint-by-sprint build log in [`TASKS.md`](./TASKS.md).
Recording-day playbook in [`docs/DEMO.md`](./docs/DEMO.md).

---

## Where this goes next

The current build is one Next.js app doing two jobs. The architecture it points at is a split control plane + data plane:

- **Rust data plane** — deploys anywhere (Cloudflare Workers, K8s sidecar, customer VPC, air-gapped). Tool calls never leave the customer's network.
- **Multi-region Next.js control plane** — runs where the customer's admins sit; compiles signed Navigation Bundles for the data plane to pull.
- **Protocol-agnostic surface** — MCP today, A2A tomorrow. Routes are the abstraction; transports plug in.
- **Semantic layer** — decouple "what a Lead _is_" from "how Salesforce represents a Lead" via a shared Semantic Definition Store.

Full vision + roadmap in [`VISION.md`](./VISION.md).

---

## License

MIT — see [`LICENSE`](./LICENSE).

## Credits

Built by [@mboss37](https://github.com/mboss37). Claude Opus 4.7 1M-context used throughout the build loop.
