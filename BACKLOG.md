# Backlog

> When a WP is pulled into a sprint, remove it from here. Shipped work lives in `TASKS.md`.

---

## P0: Must ship before Saturday EOD

Hard code freeze: **Sun Apr 26 12:00 CET**. Everything below lands Sat or doesn't land.

## P2: After hackathon

Signals ambition to judges who browse deep. Full vision in [`docs/VISION.md`](./docs/VISION.md).

**Enterprise:** Multi-org invite flow + RLS widening, custom policy DSL, workflow evaluator benchmark, email change, monitoring widget customization.

**Hardening:** `fetchOrgManifest` cross-tenant leak fix, IPv6 CIDR in `runIpAllowlist`, Zod `safeParse` on scoped gateway route params, `x-forwarded-for` trusted-proxy flag, `createStatelessServer` extraction, per-builtin Zod config validation on 7 older policy runners, SSRF DNS-rebinding pin, ReDoS guard on policy regex, `AbortController` on timeline chart fetch, strip internal error text from API responses, realtime `setAuth` on `onAuthStateChange` for long-lived sessions / token rotation (Sprint 22 reviewer finding), `comment on table public.mcp_events` contract noting INSERT-only assumption behind REPLICA IDENTITY FULL (Sprint 22 reviewer finding), tighten realtime-publication contract test to assert `duplicate_object` is inside the `do $$` block (Sprint 22 reviewer finding).

**Product polish:** Periodic MCP re-discovery cron, Zod-validate gateway responses in graph page, SSE multi-event parser, sidebar nav badges, multi-origin per server, graph domain-boundaries toggle, dashboard domain filter, Supabase realtime for audit page, cosmetic cleanup sweep.

**Vision:** Navigation Bundle offline routing, A2A protocol bridge, simulation playground / LLM evaluator, OpenTelemetry tracing, Agent Card Designer, Semantic Definition Store, semantic caching, first-class rollback routes, Rust data plane.
