# Backlog

> When a WP is pulled into a sprint, remove it from here. Shipped work lives in `TASKS.md`.
>
> **Sprint 30 deferral rule:** Anything cut from Sprint 30 (TRel description-enrichment + protocol stake) lands in the `## P0: Sprint 30 deferrals` section below with rationale, not into P1/P2. P0 items are the immediate next-sprint pull. Subagents that cut scope mid-WP MUST log the deferral here in the same edit.

---

## P0: Sprint 30 deferrals

- **Proto-SEP drafting + publication.** Deferred until WP-30 telemetry shows model-behavior lift on the hosted demo and at least one external org adopts the `_meta.trel` shape. Trigger conditions intentionally tight: spec-first proposals from a single implementer with no runtime adoption get closed (Discussion #943 precedent). The schema lock at `lib/mcp/trel-schema.ts` is the canonical reference any future submission will cite verbatim.
- **`stateless-server.ts` file-size split.** Now 438 lines, over the 400-line cap. Functions still under 50 each; clean extract is `tools/list` builder + TRel handler block into `lib/mcp/handlers/list-tools.ts` + `lib/mcp/handlers/trel.ts`, keeping `createStatelessServer` as the wiring shell. ~150 LOC moved, no behavior change.
- **Graph-adherence dashboard card (WP-30.4 stretch).** API endpoint `/api/monitoring/graph-adherence` and `graph_adherence_pairs` view shipped Sprint 30. The optional KPI card on `/dashboard/monitoring` rendering governed vs raw rates side-by-side was cut to keep WP-30.4 inside the review-bandwidth budget. Pure UI work: read both buckets, render two big numbers + delta, ~80 LOC component. Files: `components/dashboard/graph-adherence-card.tsx` (new), `components/dashboard/monitoring-dashboard.tsx` (insert above call-volume section). The metric is already visible to anyone curling the API; demo can quote the numbers verbatim from a curl receipt while the card lands post-submission.

---

## P1: Post-submission, soon

- **BYOK Playground.** Today's `/api/playground/run` runs against the platform's `ANTHROPIC_API_KEY`, so wallet exposure is gated by the per-org hourly cap (`lib/playground/rate-limit.ts`). Real fix: let users supply their own provider key per workspace (Anthropic, OpenAI, Google, OpenRouter, etc.), shifting wallet risk to them and removing the spam vector entirely. Multi-model A/B falls out for free. Files: `app/dashboard/settings` for key entry (encrypted via `lib/crypto/encrypt.ts`), provider abstraction in `lib/playground/providers/`, model picker in workbench, drop the `playground_runs` rate-limit table once BYOK is the only path.

- **MCP handshake follow-ups.** Hotfix `45bf6e0` shipped spec-compliant `initialize` → `mcp-session-id` → `notifications/initialized` flow in `lib/mcp/handshake.ts`, called per-request from `discover-tools.ts` + `proxy-http.ts`. Five small follow-ups from the code-reviewer pass, all explicitly deferred:
  - **Per-request handshake memoization.** A 5-step saga route currently fires 5 init handshakes against the same upstream. Add `WeakMap<originUrl, Promise<HandshakeResult>>` scoped to one gateway request handler so all steps share one handshake. ~15 lines, no cross-region concern. File: new `lib/mcp/handshake-cache.ts`, called from `gateway-handler.ts` request scope.
  - **Comment the `sessionId: null` on init JSON-RPC error path** in `lib/mcp/handshake.ts` so future maintainers don't try to "fix" the deliberately dropped session id. Strict servers may have already invalidated it.
  - **Move `queuePermissiveInit` into `beforeEach`** in `__tests__/discover-tools.vitest.ts`. Currently a foot-gun: a new test author who copy-pastes an existing test and forgets the helper gets a confusing "tools/list got the init mock instead" failure mode.
  - **Extract `mockFetch` helper to `__tests__/_helpers/mock-fetch.ts`.** Now duplicated across `discover-tools.vitest.ts` and `mcp-handshake.vitest.ts`. A third callsite is likely within a sprint.
  - **Protocol version negotiation fallback.** `lib/mcp/handshake.ts` hardcodes `2025-03-26`. Spec-strict servers MAY refuse unknown versions; add a fallback to `2024-11-05` on a version-mismatch error. Mule tolerated `2025-03-26` so not blocking today.

## P2: After hackathon

Signals ambition to judges who browse deep. Full vision in [`docs/VISION.md`](./docs/VISION.md).

**Enterprise:** Multi-org invite flow + RLS widening, custom policy DSL, workflow evaluator benchmark, email change, monitoring widget customization.

**Hardening:** `fetchOrgManifest` cross-tenant leak fix, IPv6 CIDR in `runIpAllowlist`, Zod `safeParse` on scoped gateway route params, `x-forwarded-for` trusted-proxy flag, `createStatelessServer` extraction, per-builtin Zod config validation on 7 older policy runners, SSRF DNS-rebinding pin, ReDoS guard on policy regex, `AbortController` on timeline chart fetch, strip internal error text from API responses, realtime `setAuth` on `onAuthStateChange` for long-lived sessions / token rotation (Sprint 22 reviewer finding), `comment on table public.mcp_events` contract noting INSERT-only assumption behind REPLICA IDENTITY FULL (Sprint 22 reviewer finding), tighten realtime-publication contract test to assert `duplicate_object` is inside the `do $$` block (Sprint 22 reviewer finding).

**Product polish:** Periodic MCP re-discovery cron, Zod-validate gateway responses in graph page, SSE multi-event parser, sidebar nav badges, multi-origin per server, graph domain-boundaries toggle, dashboard domain filter, Supabase realtime for audit page, cosmetic cleanup sweep.

**Vision:** Navigation Bundle offline routing, A2A protocol bridge, simulation playground / LLM evaluator, OpenTelemetry tracing, Agent Card Designer, Semantic Definition Store, semantic caching, first-class rollback routes, Rust data plane.
