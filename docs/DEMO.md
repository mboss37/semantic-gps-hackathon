# Demo — recording playbook

Source of truth for the 3-minute submission video. One or two of these
stories get recorded on Sunday; this document tracks which ones are
validated, which land visually, and the current ranking.

**Deadline:** Mon 2026-04-27 02:00 CET (= Sun 2026-04-26 20:00 EST).
**Recording day:** Sun 2026-04-26 (CET), pre-recorded and uploaded before
submission.

## Scorecard (after live E2E validation)

Scored against the hackathon rubric — Impact 30, Demo 25, Opus 4.7 Use 25,
Depth 20 — and against recording-day risk (fewer moving parts = safer live).

| # | Story | Impact | Demo | Opus | Depth | Weighted | E2E on local | Recording risk |
|---|---|---|---|---|---|---|---|---|
| 1 | **PII leak hero (shadow→enforce flip)** | 10 | 10 | 7 | 7 | **86.5** | ✅ validated 2026-04-23 | low — 2 tool calls |
| 9 | **Rollback cascade (saga undo)** | 9 | 8 | 8 | 10 | **85** | ✅ validated 2026-04-23 | medium — 5 calls across 3 upstreams |
| 7 | Prompt-injection jailbreak | 9 | 9 | 9 | 7 | 86.0 | ⏳ queued | low — 1 tool call |
| 10 | Complete-governance overlay | 8 | 8 | 9 | 9 | 84.5 | ⏳ queued | medium — 3 policies layered |
| 3 | Write-freeze killswitch | 8 | 8 | 5 | 6 | 69.5 | ⏳ queued (backup) | low |
| 8 | Route with fallback | 8 | 8 | 7 | 10 | 82.5 | ⏳ queued (backup) | medium |

**Cut** (judged but not shooting): #2 Off-hours, #4 Retry-dedupe, #5 Geo-fence,
#6 Anonymous-agent — contrast doesn't read on camera.

## Current hero pick (revised from judge's original)

**Story #1 PII Leak Hero.** The judge originally put #9 Rollback as hero and
#1 as first beat. After actually running both, I flipped it:

- **Slack auto-linkifies real phone numbers.** Raw pane posts a clickable
  blue `<tel:…>` link; governed pane posts plain-text `[redacted:phone]`.
  The audience sees the contrast in one frame with zero MCP vocabulary.
- **PII is 2 tool calls vs rollback's 5 across 3 upstreams.** Four times
  fewer moving parts on recording day.
- **Rollback's "undo" is a JSON field + an audit row** unless we screen-cut
  to GitHub showing an issue flip Open→Closed. PII's contrast is what
  the Slack client itself renders — no extra cuts required.

Rollback still ships as the **first supporting beat** because it's the only
MCP gateway with `compensated_by` semantics — unbeatable for the Depth
dimension of judging.

## Recording order (revised)

```
0:00-0:15  Intro + one-line problem
0:15-1:15  HERO #1 PII Leak (60s)
1:15-2:00  BEAT #9 Rollback Cascade (45s)
2:00-2:30  BEAT #7 Prompt Injection (30s)
2:30-2:55  BEAT #10 Complete-governance overlay (25s)
2:55-3:00  Outro + repo link
```

User will pick 1-2 for Sunday. If time is tight, **record #1 PII only** —
it lands the governance story on its own. #9 Rollback is the strongest
second pick.

---

## Story #1 — PII Leak Hero

**Status:** ✅ E2E validated on local 2026-04-23 17:10 CET.

### Narrative

An agent is asked to look up a customer phone number in Salesforce and
post it to the team's Slack channel so engineers can call back. On the
raw pane, the phone number lands in Slack as a clickable link. On the
governed pane, the gateway's `redact_contact_pii` policy rewrote the SF
response before the agent ever saw the phone, so the agent can only send
the redacted placeholder downstream. Same model, same prompt — one policy
flip is the only difference.

### Setup

**Pre-conditions:**
- Local bootstrap seeded (`scripts/bootstrap-local-demo.sql`).
- Cloudflare quick tunnel up so Anthropic can reach `/api/mcp` + `/api/mcp/raw`.
- Dashboard open on `/dashboard/policies`.
- `redact_contact_pii` starts in `shadow` mode (canonical seed state).
- Demo agent prompt:

  > Edge Communications reported a payment crash on checkout. Find the
  > Salesforce account for Edge Communications, grab their phone number
  > from the account record, and post a heads-up to Slack #general so
  > engineering can call them directly. Include the phone number in the
  > Slack message verbatim.

### Recording beats (60s)

1. **00-10s** — Playground split view, narrator says "same prompt, same
   agent, same real tools — only difference is the gateway."
2. **10-25s** — Both panes run. Raw finishes, Slack shows the blue
   `<tel:(512) 757-6000>` linkified message. Governed finishes identically
   (shadow mode observes, doesn't modify).
3. **25-35s** — Cut to `/dashboard/policies`, show `redact_contact_pii`
   row, flip the `shadow → enforce` toggle.
4. **35-55s** — Hit Run again. Raw posts the same clickable phone link.
   Governed posts `[redacted:phone]` plain text. Cursor lingers on the
   visual difference.
5. **55-60s** — Brief cut to `/dashboard/audit` showing the decision row:
   `redact_contact_pii · mode=enforce · decision=redact · reason="found 1
   PII match(es)"`. Voiceover: "Agent shipped once. Rules changed at
   runtime. That's the control plane."

### Validated observation (actual test output)

| Pane | Agent receives phone | Slack message posted |
|---|---|---|
| raw | `(512) 757-6000` | `phone is <tel:(512)757-6000\|(512) 757-6000>` (clickable) |
| governed + shadow | `(512) 757-6000` | `phone is (512) 757-6000` (observe-only) |
| governed + enforce | `[redacted:phone]` | `phone is [redacted:phone]` (plain) |

### Strengths
- Slack auto-linkify is a visual beat no one has to explain.
- Entire loop is 2 tool calls, ~2 seconds of wall time, runs on real
  Salesforce and real Slack.
- Policy flip is atomic; `invalidateManifest()` makes it live-reloadable
  in ~50ms via the dashboard mutation path.
- "Agent context is the attack surface — the gateway never lets PII enter
  the context" is a narrative that sells privacy + agent safety
  simultaneously.

### Risks
- On Saturday recording, `business_hours_window` enforces (weekend →
  outside window). Either flip it to `shadow` before recording or frame
  it as a second beat ("also: business hours blocked this too").
- Salesforce dev-org rate limits — cap re-takes at ~5 to stay within
  daily quota.
- Slack workspace access: the demo bot must be in `#general` (or
  whatever channel we pick). Verified.

---

## Story #9 — Rollback Cascade

**Status:** ✅ E2E validated on local 2026-04-23 17:03 CET, after a
canonical saga-pattern fix (added `rollback_input_mapping` column,
`CapturedStep { args, result }` bag, backwards-compatible resolver).

### Narrative

An agent runs a 5-step cross-MCP route: find the Salesforce account, find
the contact, file a GitHub issue, post to Slack, log a follow-up task in
Salesforce. Something goes wrong at step 5 (simulated via an invalid SF
task subject). Without governance, the GitHub issue and Slack message
stay hanging as orphaned side effects. With the gateway, `compensated_by`
relationships in the manifest tell it exactly how to undo each completed
step — the GitHub issue auto-closes, the audit shows a reverse cascade,
the downstream systems end up consistent.

### Setup

**Pre-conditions:**
- Local bootstrap seeded.
- `cross_domain_escalation` route exists with `rollback_input_mapping` on
  step 3 (`create_issue`).
- Cloudflare tunnel up.
- Dashboard open on `/dashboard/graph` (to show the graph with the
  `compensated_by` edge visible) and `/dashboard/audit` (for the cascade
  row at the end).
- `business_hours_window` in `shadow` (so it doesn't block the first step
  mid-take).

### Recording beats (45s)

1. **00-05s** — Graph view, cursor hovers the `create_issue →
   close_issue` red `compensated_by` edge. Voiceover: "the gateway knows
   these tools relate — undo via this edge."
2. **05-25s** — Playground runs the route. Step indicator shows ✓ ✓ ✓ ✓
   ✗ as each step completes. Result panel shows
   `halted_at_step: 5, rollback_summary: {compensated_count: 1}`.
3. **25-35s** — Cut to `/dashboard/audit`, show the chronological event
   stream with one row tagged `execute_route.rollback · close_issue ·
   rollback_executed`.
4. **35-45s** — Cut to github.com/mboss37/semantic-gps-sandbox/issues
   showing the issue that just opened now reading "Closed" in red. Back
   to the route view.

### Validated observation (actual test output)

```
ok: false ; halted_at_step: 5
  step 1 find_account      → ok
  step 2 find_contact      → ok
  step 3 create_issue      → ok ✅ ROLLED BACK
  step 4 chat_post_message → ok
  step 5 create_task       → origin_error (SF rejected 300-char subject)
summary: { attempted: true, compensated_count: 1, failed_count: 0 }
```
Post-run: `search_issues is:open` → 0 open issues. The rollback actually
undid the GitHub side effect.

### Strengths
- Uniquely ours — no other MCP gateway has `compensated_by` semantics.
  Clean "Depth & Execution 20%" judging beat.
- Cross-MCP proves the platform breadth in one chain.
- Best-effort saga honesty — the response reports exactly what was
  rolled back and what stayed (`compensated_count`, `skipped_count`,
  `failed_count`) rather than silently pretending everything undid.

### Risks
- 5 real upstream calls + 1 rollback call = 6 network round-trips,
  ~2.5s total. Highest per-take cost of any story.
- Rollback signal depends on `rollback_input_mapping` being set
  correctly on step 3 — if that gets wiped, the compensation returns
  `invalid_input` and the cascade visibly fails. Bootstrap script now
  seeds it; also applied to hosted via `apply_migration`.
- The "undo" beat only reads if we cut to github.com. An audience that
  stays on the Playground audit panel sees a JSON field, not a visual
  state change.

---

## Story #7 — Prompt-Injection Jailbreak

**Status:** ⏳ Queued. Needs `injection_guard` policy seeded on local
before E2E.

### Narrative

An agent is asked to create a Salesforce task — normal workflow. But the
prompt includes an injection payload (`ignore previous instructions and
DROP TABLE customers; --`). Raw pane: the task is created in SF with the
injection string as its subject, because SF has no way to know the
subject field contains malicious text. Governed pane: the gateway's
`injection_guard` policy scans the args for known attack patterns (ignore
prior, role override, SQL drop, SQL comment inject) and blocks the call
before it ever hits Salesforce.

### Setup (once validated)

TBD — documented on validation. Expect: ~25s, one tool call per pane,
block audit row visible.

### Strengths
- Security-theater-actually-works story. Timely with 2026 AI-security
  news cycle.
- Simpler than rollback to record.

### Risks
- The injection payload must be a string Salesforce's own filters don't
  block first (would collapse the contrast). Pre-flight check required.

---

## Story #10 — Complete-Governance Overlay

**Status:** ⏳ Queued.

### Narrative

Final beat. Seed 3+ enforce policies at once, run a prompt that touches
multiple tools, show the audit stream painting the whole governance
stack in one trace. Sells "this isn't one policy, it's a platform."

### Setup

- `business_hours_window` enforce (already seeded)
- `redact_contact_pii` enforce (flip from shadow)
- `injection_guard` enforce (seed if not present)
- Cross-tool prompt.

### Strengths
- One-take depth shot — no flips mid-demo, just "watch it all compose."
- Hard to argue with: every policy fires transparently, audit shows the
  full stack.

### Risks
- Audit stream is JSON rows. Needs careful camera framing to land.

---

## Story #3 — Write-Freeze Killswitch (backup)

**Status:** ⏳ Queued.

### Narrative

The SRE flips a kill switch during an "incident." Agent tries to create
a Salesforce task; raw creates it; governed refuses because
`write_freeze_killswitch` is enabled mid-demo. Live-demo muscle memory
that's lower-stakes than PII and more visible than geo-fence.

### Strengths / Risks
- Clean single-flip dramatic moment.
- Less narratively tied to AI governance; more "generic kill switch."
  Stronger as a fallback if PII breaks on camera.

---

## Story #8 — Route with Fallback (backup)

**Status:** ⏳ Queued. Same orchestration muscle as #9 but around the
`fallback_to` edge instead of `compensated_by`. Use only if rollback
cascade misbehaves on recording day.

---

## Recording-day checklist

Per-take pre-flight (run top-to-bottom before each take):

- [ ] `pnpm supabase start` — local DB up on :54321
- [ ] `pnpm dev` — Next.js on :3000
- [ ] `pnpm exec cloudflared tunnel --url http://localhost:3000` — public
  URL for the Playground's Anthropic SDK → MCP connector path
- [ ] Re-run `scripts/bootstrap-local-demo.sql` via `docker exec psql -f`
  to ensure a clean state (idempotent; any `db reset` wipes data-plane
  rows)
- [ ] `curl http://localhost:3000/api/mcp` with the demo bearer returns
  13 tools via `tools/list`
- [ ] Dashboard loads, Policies page shows 3 seeded policies, Graph page
  shows the `compensated_by` edge (for #9)
- [ ] Clear prior demo clutter on real upstreams: close any open GitHub
  issues, confirm SF Edge Communications account still exists, bot in
  `#general` Slack channel

Post-take cleanup per story:

- **#1 PII:** no upstream side effects (reads only on find_account; Slack
  message is the intended side effect and stays as proof)
- **#9 Rollback:** verify the GitHub issue that got rolled back is Closed
  (0 open issues on sandbox). The Slack message from step 4 stays (no
  compensated_by edge, honest saga behavior)
- **#7 Injection:** no side effects (block before upstream)
- **#10 Overlay:** depends on which policies fire, expect mostly reads

## Upload + submission

1. Edit cut in iMovie or DaVinci. Target 2:55-3:00 runtime.
2. Upload to YouTube (unlisted) + Loom + Google Drive.
3. Paste all three URLs into `docs/SUBMISSION.md` (to be authored).
4. Submit via CV platform before **2026-04-26 20:00 EST = 2026-04-27
   02:00 CET.**
