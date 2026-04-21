---
paths: ["lib/security/**", "lib/crypto/**", "lib/openapi/**", "app/api/openapi-import/**"]
---

# Security Rules

- **Every outbound fetch** from user-supplied URLs goes through `lib/security/ssrf-guard.ts`:
  - Block 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  - Use `safeFetch` / `fetchWithTimeout` — never bare `fetch()` on a user URL
  - DNS-resolve and re-check IPs to prevent rebinding
- **Credentials at rest** — anything written to `servers.auth_config` passes through `lib/crypto/encrypt.ts` (AES-256-GCM). Plaintext in Postgres = table dump = game over.
- `CREDENTIALS_ENCRYPTION_KEY` is a 64-char hex env var — never inline, never log, never commit
- Read secrets from `process.env.*` only — in tests use `process.env.X ?? ''`
- Never log credentials, bearer tokens, API keys, or raw MCP payloads — pass through `redactPayload()` first
- Zod `.safeParse()` on every public boundary including the OpenAPI-import URL field
- JWT tokens in test fixtures are still secrets — use fixture factories, never inline
- Never trust MCP tool arguments — validate against `inputSchema` before proxy
