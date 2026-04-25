# Backlog

> When a WP is pulled into a sprint, remove it from here. Shipped work lives in `TASKS.md`.

---

## P0 — Must ship before Saturday EOD

Hard code freeze: **Sun Apr 26 12:00 CET**. Everything below lands Sat or doesn't land.

- **Fallback route unseeded** — code path works but zero `fallback_to` relationships in seed. Add one honest pair (e.g. `create_task → chat_post_message`). Blocks demo story #8. ~20 min.
- **Landing page v1** — tighten hero copy to final narrative, replace placeholder dashboard rows, add video slot (`NEXT_PUBLIC_DEMO_VIDEO_URL`), real architecture diagram, stat-strip, responsive audit, delete `landingPageReference/` folder + ignore entries.
- **Demo narrative** — pick positioning angle (SF-complements / AI-security / DevOps-first), write ≤15-word pitch, Playground A/B script, PII target tool, README paragraph.
- **Playground preset validation** — drive each preset through the actual UI via cloudflared tunnel, confirm tool picks + pane contrast, rewrite prompts if agent picks wrong tool order.
- **Vercel env vars** — add `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SLACK_BOT_TOKEN`, `GITHUB_PAT` to Vercel project + redeploy. Blocks demo recording.
- **Demo recording + submission** — record, edit, upload, finalize `SUBMISSION.md` + `README.md` + LICENSE, repo public, submit. Full checklist in `docs/DEMO.md`.

## P1 — Nice-to-have if P0 done by Saturday lunch

High-ROI items that move judging score. Skip if P0 runs late.

- **Managed Agents wrap** ($5K side prize) — port demo agent to Managed Agents API, keep SDK fallback. Only the demo agent, never the gateway.
- **Gateway token auto-mint on signup** — fresh signup → Playground fails (no bearer). Extend `handle_new_user` trigger or onboarding wizard to mint a default token.
- **Opus relationship inference on import** — feed OpenAPI spec to Opus 4.7 with cached system prompt, user approves/rejects proposals. 1M-context showcase.
- **Playground "Refine with Opus"** — ingest traces + policy events + manifest, return structured suggestions as cards.
- **Email verification decision** — disable "Confirm email" for soft-launch OR configure Resend SMTP.
- **Hosted E2E smoke test** — signup → onboard → register MCP → mint token → curl gateway → tools/list returns.
- **Password reset flow** — request + submit pages.
- **Settings page** — username + org name edit.

## P2 — After hackathon

Signals ambition to judges who browse deep. Full vision in [`VISION.md`](./VISION.md).

**Enterprise:** Multi-org invite flow + RLS widening, custom policy DSL, workflow evaluator benchmark, email change, monitoring widget customization.

**Hardening:** `fetchOrgManifest` cross-tenant leak fix, IPv6 CIDR in `runIpAllowlist`, Zod `safeParse` on scoped gateway route params, `x-forwarded-for` trusted-proxy flag, `createStatelessServer` extraction, per-builtin Zod config validation on 7 older policy runners, SSRF DNS-rebinding pin, ReDoS guard on policy regex, `AbortController` on timeline chart fetch, strip internal error text from API responses, realtime `setAuth` on `onAuthStateChange` for long-lived sessions / token rotation (Sprint 22 reviewer finding), `comment on table public.mcp_events` contract noting INSERT-only assumption behind REPLICA IDENTITY FULL (Sprint 22 reviewer finding), tighten realtime-publication contract test to assert `duplicate_object` is inside the `do $$` block (Sprint 22 reviewer finding).

**Product polish:** Periodic MCP re-discovery cron, Zod-validate gateway responses in graph page, SSE multi-event parser, sidebar nav badges, multi-origin per server, graph domain-boundaries toggle, dashboard domain filter, Supabase realtime for audit page, cosmetic cleanup sweep.

**Vision:** Navigation Bundle offline routing, A2A protocol bridge, simulation playground / LLM evaluator, OpenTelemetry tracing, Agent Card Designer, Semantic Definition Store, semantic caching, first-class rollback routes, Rust data plane.
