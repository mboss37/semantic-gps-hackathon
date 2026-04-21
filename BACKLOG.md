# claude-hackathon - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

## [P0 Sat AM] Record fallback demo clip — CANNOT SLIP
Hero scenario (Live Policy Swap w/ PII redaction) recorded 5 takes minimum on Saturday morning using the deployed Vercel URL. Mirror-upload to YouTube (unlisted) + Loom + Google Drive. Saturday recording IS the submission video — Sunday is for summary + upload only, not for debugging.

- [ ] Record hero scenario (~75s) + OpenAPI import (~45s) + workflow graph (~30s) + intro/outro (~30s) = 3 min
- [ ] Cut in iMovie / DaVinci, scripted voiceover, no "um"s
- [ ] Upload to YouTube unlisted + Loom + Drive; paste all 3 URLs into `docs/SUBMISSION.md`

## [P0 Sat PM] README + submission summary
Replaces CNA boilerplate. **Required for submission.**

- [ ] `README.md` — one-paragraph pitch, quickstart (`supabase start` → `.env.local` → `pnpm dev`), env table, Vercel link, demo video embed
- [ ] `docs/SUBMISSION.md` — 100–200 word written summary for CV platform

## [P0 Sat] Replace CNA landing
CNA branding leaks into `app/layout.tsx` tab title + `app/page.tsx` marketing shell. Fix before recording.

- [ ] `app/layout.tsx` — replace metadata (`title: "Create Next App"`, description)
- [ ] `app/page.tsx` — thin Semantic GPS landing with "Open Dashboard" CTA (or direct redirect to `/dashboard`)

## [P1 Fri–Sat] Managed Agents wrap for demo agent ($5K side prize)
**Conditional on Thursday decision gate.** Default: cut. Reconsider only if Michael Cohen's Thu 11am session reveals <2h migration cost on top of the raw SDK demo agent (WP-3.6). Apply only to the demo agent, never to the product gateway.

- [ ] Port demo-agent loop from `@anthropic-ai/sdk` manual loop → Claude Managed Agents API call
- [ ] Point at deployed `/api/mcp` endpoint as tool surface
- [ ] Wire extended thinking blocks into the embedded agent UI panel
- [ ] Keep raw SDK version maintained as fallback (don't delete)

## [P2 stretch] `validate_workflow` TRel method
Stage 4 of 4 TRel methods. Not required for hero scenario. Pull in only if WP-3.5 ships before Friday noon.

- [ ] `validate_workflow({ tool_chain })` — runs policy assignments + relationship constraints against a proposed chain, returns `{ valid, violations }`
- [ ] Unit test in `__tests__/trel.vitest.ts`

## [P2 stretch] Opus-powered relationship inference on OpenAPI import
On import, Opus 4.7 reads full OpenAPI spec (long-context play) and proposes the initial relationship graph by reasoning about endpoint dependencies. Big Opus-showcase feature. Adds ~4h to import flow.

- [ ] Post-import step: feed full spec to Opus with cached system prompt, ask for relationship proposals
- [ ] User approves/rejects in dashboard before persistence
- [ ] Surface thinking blocks so judges see the reasoning

## [P2 stretch] Natural-language policy author
User types "block PII on external domains after 6pm" → Opus translates to structured policy config. Clean Opus beat, nice demo garnish.

- [ ] Textarea in policy editor with "Ask Opus" button
- [ ] Returns JSON matching one of the 2 built-in schemas
- [ ] User reviews before save

## [P2 stretch] Extended thinking side panel in demo agent
Live-render Opus thinking blocks in the embedded agent UI. Heavily scored under Opus 4.7 Use but adds ~4h of streaming UI.

- [ ] SSE stream of thinking events from demo agent to panel component
- [ ] Collapsible "Show reasoning" toggle

## [P2 stretch] Rate-limit + injection-guard policies
Two of four built-in policies deferred from Sprint 3. Ship only if PII + allowlist land early and demo needs more variety.

- [ ] `rate_limit` (in-memory, per-tool, reset on gateway cold-start — acceptable for demo)
- [ ] `injection_guard` (regex-only, not LLM-backed, to keep latency down)

## [P2] GitHub repo metadata polish — check before demo
Repo topics + license + branch protection done in Sprint 1. Remaining polish for submission credibility.

- [ ] Repo About section — short description ("MCP control plane for agentic workflows — hackathon build") + website URL (Vercel deploy)
- [ ] Social preview image — 1280×640 og-image so link unfurls look professional on X / Slack / Discord
- [ ] Verify `LICENSE` renders correctly on GitHub (should show the license type in the About panel)
- [ ] Verify repo description + topics still match final scope after build

## [P2] Cosmetic cleanup
- [ ] `components/ui/button.tsx` — shadcn ships without semicolons; our `.prettierrc` wants them. Run `pnpm exec prettier --write components/ui` to normalize next time it's touched.

## [P2] Wire GitHub status check for branch protection
Branch protection on `main` expects a status check named `"Lint · Type-check · Test"` that isn't configured — every push logs a "Bypassed rule violations" line. Set up a GitHub Actions workflow running `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test` so pushes are actually gated. Low-priority because the local pre-commit hook already blocks bad commits.

- [ ] `.github/workflows/ci.yml` — node 22 + pnpm, cache `~/.pnpm-store`, run the 3 gates
- [ ] Confirm branch-protection status-check name matches the workflow's job name

## [P2] ReDoS guard on policy config regex
`lib/policies/built-in.ts::compilePatterns` does `new RegExp(config.patterns[].regex, 'gi')` with no validation — a malicious or sloppy policy config can slip in catastrophic backtracking (`(a+)+$` etc.). Acceptable in single-user MVP. Before multi-tenancy, validate with `safe-regex` or wrap each `runPiiRedaction` scan in a `setTimeout`-based fuse that aborts long matches.

- [ ] Pre-validate user regex on write (`/api/policies` POST/PATCH) with a `safe-regex` check
- [ ] Or: runtime fuse — wrap each scan in a fuse that rejects beyond N ms

## [P2] Strip internal error text from API responses
Several routes bubble Supabase error messages through a `details` field (e.g. `{ error: "update failed", details: err.message }`). Matches CLAUDE.md "never expose internal error details" prohibition. Keep detail going to server logs, return only stable error codes to clients.

- [ ] Replace `details: err.message` with `console.error(...)` + opaque `error_code` in the response body across `/api/servers`, `/api/openapi-import`, `/api/policies*`

## [P2] Harden SSRF guard against DNS-rebinding
`lib/security/ssrf-guard.ts` validates DNS on entry but `fetchWithTimeout` re-resolves on the actual request — a malicious authoritative server can return a public IP first (passes the check) and a private IP on the hot fetch. Acceptable for hackathon scope (guard still blocks the obvious attacks) but the canonical fix is to pin the pre-validated IP into a custom `undici.Agent` with a fixed `lookup` function so the request hits the exact address we verified. Pull in when we wire real third-party MCP server imports.

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
