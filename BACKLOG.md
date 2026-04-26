# Backlog

> When a WP is pulled into a sprint, remove it from here. Shipped work lives in `TASKS.md`.

---

## P0: Must ship before Saturday EOD

Hard code freeze: **Sun Apr 26 12:00 CET**. Everything below lands Sat or doesn't land.

- **Landing page v1**: tighten hero copy to final narrative, replace placeholder dashboard rows, add video slot (`NEXT_PUBLIC_DEMO_VIDEO_URL`), real architecture diagram, stat-strip, responsive audit, delete `landingPageReference/` folder + ignore entries.
- **Demo narrative**: pick positioning angle (SF-complements / AI-security / DevOps-first), write ≤15-word pitch, Playground A/B script, PII target tool, README paragraph.
- **Playground preset validation**: drive each preset through the actual UI via cloudflared tunnel, confirm tool picks + pane contrast, rewrite prompts if agent picks wrong tool order.
- **Vercel env vars**: add `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SLACK_BOT_TOKEN`, `GITHUB_PAT` to Vercel project + redeploy. Blocks demo recording.
- **Demo recording + submission**: record, edit, upload, finalize `README.md` + LICENSE, repo public, submit.

## P1: Nice-to-have if P0 done by Saturday lunch

High-ROI items that move judging score. Skip if P0 runs late.

- **Route Author UI v2 (visual editor)**: Sprint 28 shipped JSON import + Copy as JSON + delete (`feat/route-authoring`, ~970 LOC). v2 closes the gap to a true visual authoring surface. Scope: (a) form-based step editor with tool picker, output_capture_key field, fallback_input_mapping helper; (b) DSL autocomplete for `$inputs.<field>` and `$steps.<key>.result.<path>` references against the captured-step bag; (c) step reordering via drag-drop or up/down buttons; (d) PATCH endpoint at `app/api/routes/[id]/route.ts` (currently DELETE only, edit pattern is delete + re-import); (e) compensator coverage validation (warn when a step has no `rollback_tool_name` and no `fallback_input_mapping`); (f) `(organization_id, name)` UNIQUE constraint on routes table to make collision a DB invariant instead of an app-layer race; (g) docs page documenting the import JSON shape + DSL syntax. Files: extend `app/api/routes/[id]/route.ts` (PATCH handler), new `components/dashboard/route-step-editor.tsx`, new `components/dashboard/dsl-autocomplete-input.tsx`, migration `2026MMDDHHMMSS_routes_unique_org_name.sql`. ~6-12h. Closes the v1 limitation noted in Sprint 28 plan.
- **NL Policy Author with Opus 4.7**: textarea on policy create/edit → "Translate with Opus" button → `POST /api/policies/translate` → Opus 4.7 returns JSON matching a builtin policy schema (12 builtin shapes in cached system prompt) → user reviews + saves. Files: new `app/api/policies/translate/route.ts` (Anthropic SDK, prompt_caching ephemeral on system block), update policy create flow with NL pane + Sparkles button, validation via existing builtin schemas. Sister-project reference (UX shape only, NOT same DSL): `/Users/mboss37/Projects/semantic-gps/components/policies/nl-translator.tsx`. Biggest Opus 4.7 Use lever in the stack: judges see Opus translate plain English to policy JSON live. Parked from Sprint 22 (last build day, 2-3h scope risk). ~2-3h.
- **Opus relationship inference on import**: feed OpenAPI spec to Opus 4.7 with cached system prompt, user approves/rejects proposals. 1M-context showcase.
- **Playground "Refine with Opus"**: ingest traces + policy events + manifest, return structured suggestions as cards.
- **Email verification decision**: disable "Confirm email" for soft-launch OR configure Resend SMTP.
- **Hosted E2E smoke test**: signup → onboard → register MCP → mint token → curl gateway → tools/list returns.
- **Password reset flow**: request + submit pages.

## P2: After hackathon

Signals ambition to judges who browse deep. Full vision in [`docs/VISION.md`](./docs/VISION.md).

**Enterprise:** Multi-org invite flow + RLS widening, custom policy DSL, workflow evaluator benchmark, email change, monitoring widget customization.

**Hardening:** `fetchOrgManifest` cross-tenant leak fix, IPv6 CIDR in `runIpAllowlist`, Zod `safeParse` on scoped gateway route params, `x-forwarded-for` trusted-proxy flag, `createStatelessServer` extraction, per-builtin Zod config validation on 7 older policy runners, SSRF DNS-rebinding pin, ReDoS guard on policy regex, `AbortController` on timeline chart fetch, strip internal error text from API responses, realtime `setAuth` on `onAuthStateChange` for long-lived sessions / token rotation (Sprint 22 reviewer finding), `comment on table public.mcp_events` contract noting INSERT-only assumption behind REPLICA IDENTITY FULL (Sprint 22 reviewer finding), tighten realtime-publication contract test to assert `duplicate_object` is inside the `do $$` block (Sprint 22 reviewer finding).

**Product polish:** Periodic MCP re-discovery cron, Zod-validate gateway responses in graph page, SSE multi-event parser, sidebar nav badges, multi-origin per server, graph domain-boundaries toggle, dashboard domain filter, Supabase realtime for audit page, cosmetic cleanup sweep.

**Vision:** Navigation Bundle offline routing, A2A protocol bridge, simulation playground / LLM evaluator, OpenTelemetry tracing, Agent Card Designer, Semantic Definition Store, semantic caching, first-class rollback routes, Rust data plane.
