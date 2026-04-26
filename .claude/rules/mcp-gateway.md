---
paths: ["app/api/mcp/**", "lib/mcp/**", "lib/manifest/**", "lib/policies/**"]
---

# MCP Gateway Rules

- Gateway is **stateless**, every request builds a fresh `McpServer`, handles, disposes
- Use **HTTP-Streamable** transport only; SSE is deprecated
- Unknown MCP methods return JSON-RPC error `-32601`, not silent success, not crash
- Validate every `tools/call` payload against the tool's `inputSchema` with Zod before proxying
- **Every mutation route that touches servers/tools/relationships/policies MUST call `await invalidateManifest()` before returning**, this is the rule that makes live policy reload work
- Policy checks go through `enforceOrShadow(policy, context)`:
  - `mode === 'enforce'` + violation → reject with structured error
  - `mode === 'shadow'` + violation → log decision, let call through
  - Either way, write decision to `mcp_events.policy_decisions`
- TRel extension methods (`discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`) share the same auth + policy + audit stack as standard MCP methods
- Every gateway call writes to `mcp_events` via `logMCPEvent`, fire-and-forget, never block
- Use `redactPayload()` before logging, never write raw secrets or PII to `mcp_events`
- Service role Supabase client is used here and here only (no user session on MCP route)
- Real upstream tool calls go through `proxyOpenApi` (`transport === 'openapi'`) or `proxyDirectMcp` (`transport === 'http-streamable'`). `executeTool()` in `lib/mcp/tool-dispatcher.ts` dispatches behind `REAL_PROXY_ENABLED !== '0'` and falls back to `mockExecuteTool` when disabled, missing server/tool, or unknown transport, never silent success. Vendor-specific MCPs (Salesforce/Slack/GitHub) run as standalone HTTP-Streamable routes under `app/api/mcps/<vendor>/` and are registered via the normal `POST /api/servers` flow, the gateway has zero knowledge they're in-process. Never bare-`fetch` an upstream; always via `safeFetch` inside the proxies and the vendor adapters in `lib/mcp/vendors/`.
