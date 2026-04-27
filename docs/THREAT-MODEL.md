# Threat model

Lean cut. Names trust boundaries, enumerates the attack-surface taxonomy, and pairs each row with the mitigation present today + the gap that remains. Deepens as the project matures.

> **Reporting a security issue:** see [`SECURITY.md`](../SECURITY.md). Do not open a public issue.

## Trust boundaries

| Boundary | Who is on which side | Trust assumption |
|---|---|---|
| **Agent ↔ Gateway** | Untrusted agent on one side, the trusted gateway on the other | Every inbound request is authenticated via gateway token (SHA-256 hashed) and scoped to one org. Inputs are Zod-validated at the boundary. Agents are NEVER trusted to self-declare identity. |
| **Gateway ↔ Customer MCP** | Trusted gateway on one side, customer-controlled MCP on the other | Outbound fetches go through `lib/security/ssrf-guard.ts` (`safeFetch`). Customer MCPs are treated as semi-trusted (they handle business data) but not as policy enforcers — the gateway is the authoritative governance point. |
| **Gateway ↔ Postgres** | Same trust domain, but with RLS as a second guardrail | Every tenant table has RLS via `jwt_org_id()` (Sprint 16). Service-role client is used in exactly one place (`app/api/mcp/route.ts`); everywhere else uses the user-scoped client. |
| **Control plane ↔ Data plane** | Currently the same Next.js app | Future architecture splits these (see `docs/VISION.md` § "Future architecture"). Until then, both share the same process boundary. |
| **Customer ↔ Maintainer (this repo)** | Customer's encrypted secrets in maintainer's DB | Stored credentials encrypted with AES-256-GCM (`lib/crypto/encrypt.ts`). The encryption key is environment-bound and never persisted to source. |

## Attack-surface taxonomy

| # | Attack | Mitigation present | Gap | Customer-side responsibility |
|---|---|---|---|---|
| 1 | **Auth bypass on the gateway** | Bearer-token auth on every gateway call, SHA-256 hashed in `gateway_tokens.token_hash`. Tokens are org-scoped and minted via the dashboard or CLI. | No automated rotation, no per-token rate limit on the gateway path itself (only on Playground per WP-A.4). | Rotate tokens on personnel changes. Revoke on leak. |
| 2 | **Cross-organization data leakage** | RLS on every tenant table (Sprint 16 L.1), evaluated against `jwt_org_id()`. App-layer `.eq('organization_id', ...)` filter as belt-and-braces. RLS-aware view (`graph_adherence_pairs`) sets `security_invoker = on` so view callers are scoped per-user. | No automated cross-org IDOR fuzzing in CI yet (manual sweep ran in Sprint 16). | Use the dashboard's audit page to spot-check that returned data is yours. |
| 3 | **SSRF via customer-supplied origin URL** | `lib/security/ssrf-guard.ts::safeFetch` blocks: `bad_scheme`, `bad_host` (incl. `localhost` unless the dev escape hatch is set), `private_ip`, `dns_failed`. Used by both `lib/mcp/proxy-http.ts` and `lib/mcp/proxy-openapi.ts`. | IPv6 CIDR coverage is partial (BACKLOG). DNS-rebinding pin is not implemented (BACKLOG). | Register only HTTPS origins on production. |
| 4 | **Credential exfiltration** | Stored credentials are AES-256-GCM encrypted at rest (`lib/crypto/encrypt.ts`); only decrypted in-process at proxy time. `redactPayload()` runs before any audit row is written, so secrets never land in `mcp_events`. | No HSM integration; the encryption key lives in env vars. Service-role Supabase key is the highest-privilege secret in the system. | Restrict who has access to the deployment env vars. Use Vercel's encrypted env-var feature. |
| 5 | **Prompt injection through user-supplied tool inputs** | `injection_guard` policy (default patterns: `ignore_prior`, `role_override`, `im_start`, `sql_drop`, `sql_comment_inject`) runs as a pre-call gate. Both `enforce` and `shadow` modes log the verdict to `mcp_events.policy_decisions`. | Pattern set is not exhaustive; novel injection styles slip through. ReDoS guard on policy regex is BACKLOG. | Configure the policy in `enforce` mode for write-capable tools after a shadow-mode validation period. |
| 6 | **Denial of service** | Vercel function timeout (300s) caps any single request. Playground-specific 6/hour rate limit on `/api/playground/run` (Sprint 29 — wallet protection against the platform's Anthropic key). | Gateway path itself has no global rate limit. Per-org rate-limit policy exists per-tool, not per-org-overall. | Front the gateway with your own rate-limit layer (Cloudflare, Vercel WAF) for production deployments. |
| 7 | **Replay on saga state / audit / rollback** | Each `tools/call` and `execute_route` invocation generates a fresh `trace_id` (or honors a caller-supplied UUID per Sprint 27). Audit rows are append-only INSERTs; no UPDATE path. | No request-signature validation (Web Bot Auth on roadmap). No idempotency keys on individual `tools/call` invocations (only via the `idempotency_required` policy when configured). | Configure `idempotency_required` for any tool whose external effect must not be repeated. |
| 8 | **Time-of-check-time-of-use on policy evaluation** | Policies evaluate against the manifest cached for the current request. `invalidateManifest()` runs after every mutation, so the cache cannot serve stale shadow-vs-enforce verdicts to a request that started after the flip. | A request that was already in-flight when the policy flipped runs to completion under the old verdict (intentional — interrupting in-flight saga steps is worse than honoring the old policy for one tail call). | Roll out enforce flips during low-traffic windows for hot tools. |
| 9 | **Audit log tampering / disappearance** | Append-only INSERT path. RLS on `mcp_events` per org. Rows include `trace_id` for cross-step correlation. | No cryptographic hash chain on rows. No archival pipeline yet (retention is the responsibility of the underlying Postgres). | Pull `mcp_events` to your own SIEM if regulatory retention is a hard requirement. |
| 10 | **Supply-chain compromise of the gateway** | All dependencies pinned via `pnpm-lock.yaml`. `pnpm` defers to lockfile resolution. No automated SBOM yet. | No automated dependency vulnerability scanning in CI. No Sigstore / signed releases. | Self-host or audit the deployed image yourself if the supply-chain risk is unacceptable. |

## What this document is not

- **Not a SOC 2 control matrix.** That requires an auditor, scoped period, and continuous evidence. This is an engineering-honest accounting; it does not constitute compliance.
- **Not a substitute for penetration testing.** External pentest is on the roadmap once external adopters appear.
- **Not exhaustive.** The web-app surface, supabase admin surface, and Vercel-runtime surface have additional considerations not enumerated here. Add as the project encounters them.

## Roadmap

- Quarter 1 post-traction: external pentest, automated dependency scanning in CI, IPv6 CIDR coverage in SSRF guard, per-org rate-limit policy on the gateway path.
- Quarter 2 post-traction: signed Navigation Bundles, agent-identity (Web Bot Auth / IETF HTTP Message Signatures), SBOM generation per release.
- Quarter 3 post-traction: chaos / Jepsen-style failure-mode testing, audit-log hash chain, archival pipeline.
