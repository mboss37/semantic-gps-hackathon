---
name: open-sprint
description: Open a new sprint by pulling WPs from BACKLOG into TASKS.md § Current, with BACKLOG removal enforced in the same phase. TRIGGER when user runs /open-sprint or asks to "open a sprint" / "start sprint N" / "pull items from backlog into a sprint". DO NOT TRIGGER mid-sprint, or on routine edits, or on wrap-up. Side-effecting on TASKS.md + BACKLOG.md, always proposes scope before applying.
argument-hint: "[optional sprint number; defaults to next]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
disable-model-invocation: true
---

# Open Sprint

Pull 3-6 WPs from `BACKLOG.md` into `TASKS.md § Current`, atomically removing them from the backlog. 

## Preconditions

Abort with a clear message if any of these fail:

- `TASKS.md` exists and has a `## Current:` section header
- **`## Current:` is empty** (no unchecked `[ ]` items under it). If open WPs remain → abort: *"Current sprint has open items. Finish them or run /wrap-sprint first."*
- `BACKLOG.md` exists and contains at least one WP (checkable lines matching `^- \*\*<ID>\*\*` or similar)
- Working tree is clean (`git status --porcelain` empty except untracked artifacts). Wrap-up of prior sprint must have landed. *"Commit or stash in-flight changes first; open-sprint will propose atomic edits across TASKS.md + BACKLOG.md."*

## Phase 1: Research

No edits. Build full context.

1. **Read `TASKS.md` tail.** Confirm the last sprint closed (session log entry present, Current empty). Note the next sprint number = last completed + 1.
2. **Read `BACKLOG.md` in full.** Enumerate open WPs grouped by section (A/C/F/G/H/I/J etc.). For each, note: ID, size (S/M/L), dependency arrows (`← X` / `→ Y`), one-line intent.
3. **Read CLAUDE.md § Hackathon Mission** (if present) and the most recent memory via `memory_search` for hackathon deadline + judging weights. Confirm time remaining + ROI framing.
4. **Scan recent git log** (`git log --oneline -10`) to confirm the last sprint's commits are pushed and no uncommitted doc drift remains.
5. **Check `.claude/rules/*.md`** for any active guardrails relevant to the WPs you'll propose.

**Done when:** you can answer in one paragraph: *what's open in BACKLOG, what's the next sprint number, and how much time remains to ship.*

## Phase 2: Propose sprint scope

Print a structured proposal to the user. Be terse.

Required elements:
- **Sprint theme** (one line, the "why of this sprint")
- **3-6 candidate WPs** from BACKLOG, ranked by ROI against judging weights (Impact 30 / Demo 25 / Opus 4.7 Use 25 / Depth 20 for this repo). Size each (S/M/L).
- **Dependencies resolved**, if a proposed WP has `← X` on an open BACKLOG item, either include X in this sprint or note why the dep is acceptable.
- **Lane assignment**, subagent lanes A/B/C vs main thread. Parallel where possible.
- **Explicit cut list**, what you're NOT pulling this sprint and why (brief).

Example proposal shape:

```
## Sprint N proposal, [theme]

Time check: [X hrs until build cutoff]. Judging-weight framing: [brief].

### Pulling (4 WPs)
1. I.5 (M) Managed Agents wrap, $5K side prize
2. G.7 (M) Per-server detail, judges can copy MCP config
3. J.2 (M) E2E Vercel verification
4. Playground UI validation through tunnel (from Sat deliverables)

### Not pulling (why)
- I.6 (L) Refine with Opus, chains after I.5, defer one sprint
- G.3 (L) Route designer, routes already work seeded; post-hackathon

### Lanes
- Main: I.5 (strategic)
- Subagent A: G.7
- Subagent B: J.2
- Subagent C: Playground validation

Reply with: `approved` | `1,3` (numbers to pull) | `cancel` | inline edits.
```

Wait for user approval. Silence is not approval. Auto mode is not blanket approval for scope.

**Done when:** user replies with an explicit set of WPs.

## Phase 3: Execute atomically

**Critical phase.** Both files must be touched in the same logical step. Do NOT commit between TASKS.md edit and BACKLOG.md edit, they land together or not at all.

For each approved WP:

1. **Add to `TASKS.md § Current`**, unchecked bullet with size, ID, one-line intent, lane tag.
2. **Remove from `BACKLOG.md`**, delete the WP line entirely.

Order doesn't matter within the phase; what matters is that BOTH edits are complete before the phase ends.

Insert pattern for `TASKS.md`:

```markdown
## Current: Sprint N, [theme] ([date])

[One-paragraph why, what judging signal / demo beat / dev friction this sprint buys]

- [ ] **N.1** (S|M|L) [intent]. (Main thread. | Subagent lane A.)
- [ ] **N.2** ...
```

Replace the entire existing `## Current:` line (and anything between it and the next `##`) with the new block.

Deletion pattern for `BACKLOG.md`:

Locate each pulled WP line via its ID (e.g. `- **I.5** (M, P1 stretch)...`) and delete the whole line. Do NOT leave empty section headers, if removing the last item under a heading empties the section, remove the heading too, or leave a placeholder: `_(all pulled or shipped)_` to keep the structure visible.

**Invariant enforcement:** after both edits land, run a sanity grep:

```bash
for id in <pulled-ids>; do
  count=$(grep -c "\*\*${id}\*\*" BACKLOG.md)
  if [ "$count" -gt 0 ]; then
    echo "VIOLATION: ${id} still present in BACKLOG.md"
    exit 1
  fi
done
```

If any pulled ID is still in BACKLOG after Phase 3, **stop and fix before proceeding to Phase 4**. Do not leave the repo in an inconsistent state.

**Done when:** TASKS Current block is populated, BACKLOG has the pulled WPs removed, and the grep invariant passes.

## Phase 4: Verify

1. `git status --porcelain`, show the user exactly which files changed. Expect TASKS.md + BACKLOG.md, nothing else.
2. `git diff TASKS.md BACKLOG.md | head -60`, print the delta so the user sees the atomic shape.
3. Remind the user:
   - Sprint is opened but NOT committed. They decide when to commit.
   - The pre-commit hook `sprint-open-check.sh` will warn if TASKS.md stages a new `## Current:` block without BACKLOG.md deletions, a backstop for cases where this skill wasn't invoked.
4. Suggested next step: "Approve scope and I kick off WP plans per the Plan First rule in CLAUDE.md."

**Done when:** user sees a clean tree + atomic diff + knows the next action.

## Edge cases

- **User wants to add net-new WPs not in BACKLOG.** Fine, add them to TASKS Current, but note that they bypassed the scoping rule. Don't touch BACKLOG for these. The hook will still warn on commit because BACKLOG has no deletions; the user can acknowledge and push through (warn, not block).
- **User pulls a WP with an unlanded dep.** Surface the dep in the proposal. Either include it or get explicit waiver.
- **Mid-sprint "add one more WP".** Open-sprint is for the initial scope. Mid-sprint additions happen in place (edit TASKS.md + remove from BACKLOG). The skill isn't needed for single-WP additions; the hook catches the hygiene.
- **Sprint cancelled mid-flight.** Return remaining open WPs to BACKLOG.md with updated notes, then run this skill cleanly for the next sprint.

## Non-goals

- Not running `/wrap-sprint`, that's the sister skill for closing.
- Not planning individual WP implementation, that's the `Plan First` rule in CLAUDE.md (per-WP plan check-in before any `Write`/`Edit`).
- Not writing code, this skill only touches TASKS.md and BACKLOG.md.
- Not a replacement for human judgment on scope, the skill asks for explicit approval of the proposal before executing.
