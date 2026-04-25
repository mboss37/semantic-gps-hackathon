# Backlog

> When a WP is pulled into a sprint, remove it from here. Shipped work lives in `TASKS.md`.

---

## P0 — Must ship before Saturday EOD

Hard code freeze: **Sun Apr 26 12:00 CET**. Everything below lands Sat or doesn't land.

- **Landing page v1** — tighten hero copy to final narrative, replace placeholder dashboard rows, add video slot (`NEXT_PUBLIC_DEMO_VIDEO_URL`), real architecture diagram, stat-strip, responsive audit, delete `landingPageReference/` folder + ignore entries.
- **Demo narrative** — pick positioning angle (SF-complements / AI-security / DevOps-first), write ≤15-word pitch, Playground A/B script, PII target tool, README paragraph.
- **Playground preset validation** — drive each preset through the actual UI via cloudflared tunnel, confirm tool picks + pane contrast, rewrite prompts if agent picks wrong tool order.
- **Vercel env vars** — add `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SLACK_BOT_TOKEN`, `GITHUB_PAT` to Vercel project + redeploy. Blocks demo recording.
- **Demo recording + submission** — record, edit, upload, finalize `SUBMISSION.md` + `README.md` + LICENSE, repo public, submit. Full checklist in `docs/DEMO.md`.

## P1 — Nice-to-have if P0 done by Saturday lunch

High-ROI items that move judging score. Skip if P0 runs late.

- **NL Policy Author with Opus 4.7** — textarea on policy create/edit → "Translate with Opus" button → `POST /api/policies/translate` → Opus 4.7 returns JSON matching a builtin policy schema (12 builtin shapes in cached system prompt) → user reviews + saves. Files: new `app/api/policies/translate/route.ts` (Anthropic SDK, prompt_caching ephemeral on system block), update policy create flow with NL pane + Sparkles button, validation via existing builtin schemas. Sister-project reference (UX shape only, NOT same DSL): `/Users/mboss37/Projects/semantic-gps/components/policies/nl-translator.tsx`. Biggest Opus 4.7 Use lever in the stack — judges see Opus translate plain English to policy JSON live. Parked from Sprint 22 (last build day, 2-3h scope risk). ~2-3h.
- **Operate-cluster design system unification** — Audit + Monitoring use bespoke patterns inconsistent with the dashboard overview. Two design languages bolted together = auto-downgrade signal when judges scrub the demo video. Three sub-fixes:
  - *Audit rows → shadcn `DataTable`* (~3-4h). `app/dashboard/audit/page.tsx` currently rolls a custom button-list (each row is a `<button>` with cramped flex layout, policy chips spammed inline). Replace with the same `DataTable` the overview uses. Columns: Time / Method / Tool / Status / Latency / Trace. Filter pills (`All / Blocked / Errors / Rollbacks / Fallbacks`). Pagination. Move policy chips OUT of row, INTO the existing audit detail sheet as a "Policies evaluated" section. Trace_id column gets clickable pill affordance (currently looks like static text).
  - *All 5 charts → shadcn `ChartContainer`* (~2-3h). `components/ui/chart.tsx` is installed but never imported anywhere. Every chart reaches for raw recharts directly: `audit-chart.tsx`, `monitoring-volume-chart.tsx`, `monitoring-blocks-chart.tsx`, `monitoring-pii-chart.tsx`, `policy-timeline-chart.tsx`. Symptoms: Audit "Events by status" bars are invisible (all `fill="hsl(var(--primary))"`, no per-status tinting); Monitoring bars are fat & lonely (no `barCategoryGap` / `maxBarSize`, single populated bucket eats the canvas); tooltips hand-rolled per chart. Wrap every chart in `<ChartContainer config={...}>` with a unified palette keyed on event status (ok=green, error=red, blocked=yellow, rollback=orange, fallback=blue). Same primitive the overview area chart uses.
  - *Monitoring KPI hero strip* (~2h). Mirror overview's `SectionCards` pattern: 4-card row above the charts (Total calls / Error rate % / Block rate % / p95 latency), each with delta vs prior period + sparkline. Right now Monitoring opens with 3 mostly-empty stacked bars and zero KPI signal — judges have to mentally aggregate.
  
  Total ~7-9h. Lifts the Operate cluster from "alpha tooling" to "Datadog-tier first impression." After this, every dashboard surface (landing → overview → audit → monitoring) reads as ONE product with ONE design system. Tied to Demo 25 + Depth & Execution 20 weights.
- **Gateway token auto-mint on signup** — fresh signup → Playground fails (no bearer). Extend `handle_new_user` trigger or onboarding wizard to mint a default token.
- **Opus relationship inference on import** — feed OpenAPI spec to Opus 4.7 with cached system prompt, user approves/rejects proposals. 1M-context showcase.
- **Playground "Refine with Opus"** — ingest traces + policy events + manifest, return structured suggestions as cards.
- **Email verification decision** — disable "Confirm email" for soft-launch OR configure Resend SMTP.
- **Hosted E2E smoke test** — signup → onboard → register MCP → mint token → curl gateway → tools/list returns.
- **Password reset flow** — request + submit pages.

## P2 — After hackathon

Signals ambition to judges who browse deep. Full vision in [`VISION.md`](./VISION.md).

**Enterprise:** Multi-org invite flow + RLS widening, custom policy DSL, workflow evaluator benchmark, email change, monitoring widget customization.

**Hardening:** `fetchOrgManifest` cross-tenant leak fix, IPv6 CIDR in `runIpAllowlist`, Zod `safeParse` on scoped gateway route params, `x-forwarded-for` trusted-proxy flag, `createStatelessServer` extraction, per-builtin Zod config validation on 7 older policy runners, SSRF DNS-rebinding pin, ReDoS guard on policy regex, `AbortController` on timeline chart fetch, strip internal error text from API responses, realtime `setAuth` on `onAuthStateChange` for long-lived sessions / token rotation (Sprint 22 reviewer finding), `comment on table public.mcp_events` contract noting INSERT-only assumption behind REPLICA IDENTITY FULL (Sprint 22 reviewer finding), tighten realtime-publication contract test to assert `duplicate_object` is inside the `do $$` block (Sprint 22 reviewer finding).

**Product polish:** Periodic MCP re-discovery cron, Zod-validate gateway responses in graph page, SSE multi-event parser, sidebar nav badges, multi-origin per server, graph domain-boundaries toggle, dashboard domain filter, Supabase realtime for audit page, cosmetic cleanup sweep.

**Vision:** Navigation Bundle offline routing, A2A protocol bridge, simulation playground / LLM evaluator, OpenTelemetry tracing, Agent Card Designer, Semantic Definition Store, semantic caching, first-class rollback routes, Rust data plane.
