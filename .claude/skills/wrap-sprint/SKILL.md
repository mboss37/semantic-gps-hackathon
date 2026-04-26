---
name: wrap-sprint
description: Harvest learnings into agentic memory and catch drift in CLAUDE.md / rules / docs at the end of a sprint. TRIGGER when user runs /wrap-sprint after all current-sprint items in TASKS.md are checked. DO NOT TRIGGER mid-sprint, or to start a new sprint, or on a routine commit. Side-effecting: writes to memory, docs, and TASKS.md — always proposes changes before applying.
argument-hint: "[optional sprint number; defaults to current]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__agentic-memory__memory_search, mcp__agentic-memory__memory_store, mcp__agentic-memory__memory_update
disable-model-invocation: true
---

# Wrap Sprint

Close out a completed sprint cleanly: capture learnings in agentic memory, fix doc drift, update TASKS.md.

## Preconditions

Before running any phase:
- `TASKS.md` exists and has a `## Current:` section
- **All items in the current sprint are `[x]`.** If any `[ ]` remains → abort with: *"Current sprint has open items. Finish them or edit TASKS.md before wrapping."*
- Working tree is clean (`git status --porcelain` is empty) — wrap-up may propose file edits; we don't want them mixed with unrelated in-flight work.
- Agentic memory MCP (`mcp__agentic-memory__*`) is available. If not → abort with: *"Agentic memory MCP not available. Enable it before wrap-up."*

## Phase 1: Research

Gather full context before proposing anything. No edits in this phase.

1. **Read the sprint boundary.** Parse `TASKS.md`. Note:
   - The sprint number and name from `## Current:` (e.g., `Sprint 1 — Setup`)
   - Completed items (the `[x]` list)
   - Session log entries since the sprint opened
2. **Find git range.** Use `git log --format=format:"%H %s" main` and identify the earliest commit that clearly belongs to this sprint. If `## Completed Sprints` has prior entries, use the commit that closed the previous sprint as the lower bound. Otherwise use the repo root commit. Store as `SINCE`.
3. **Enumerate changes** with `git log SINCE..HEAD --oneline` and `git diff --stat SINCE..HEAD`.
4. **Read current truth:**
   - `CLAUDE.md` (full)
   - `docs/ARCHITECTURE.md` (sections: Stack, Project Folder Structure, API Surface, Conventions, Hard-Won Lessons, What Not To Touch)
   - `docs/VISION.md` (problem framing, what Semantic GPS solves, post-hackathon shape)
   - All files under `.claude/rules/`
   - `package.json` (dependencies / devDependencies)
5. **Search memory** — `memory_search` for:
   - `"<sprint name>"` (pull existing notes on this sprint)
   - Any keyword from the sprint WP (stack pieces, features)
6. **Scan commit messages** for signals: `fix:` (gotchas), `refactor:` (shifts in approach), `feat:` with surprising implementations.

**Done when:** you can answer in one paragraph: *what changed this sprint, and how does the codebase differ from what the docs still claim?*

## Phase 2: Identify candidates

Enumerate concrete proposals. Each candidate must have: **title, reason, proposed destination, proposed content/edit.**

### 2a. Memory candidates (type + importance)

Good candidates:
- **Decisions** mid-sprint that aren't already in docs (*e.g., "used shadcn over hand-roll because Tailwind 4 support is solid"*) — `semantic`, importance 0.6–0.8
- **Gotchas** hit and resolved (*e.g., "pnpm v10 requires onlyBuiltDependencies approval for supabase CLI"*) — `procedural`, importance 0.7+
- **Patterns** that will be reused (*e.g., "vitest smoke test pattern in `__tests__/*.vitest.ts`"*) — `pattern`, importance 0.5
- **Environment quirks** that bit you (*e.g., "BSD grep needs `--` before `- [ ]`"*) — `episodic` or `procedural`

Skip:
- Anything already stored (search first)
- Transient state (sprint progress itself)
- Things adequately captured in the git log

### 2b. CLAUDE.md updates

Check each section for drift:
- **Stack** — new core deps in package.json not reflected
- **Commands** — new scripts added to package.json
- **Architecture & Scope Docs** — new files in `docs/`
- **Conventions** — new patterns now in use
- **Off-Limits** — new off-limits revealed this sprint
- **Key Decisions** — decisions not already listed

### 2c. Rules updates (`.claude/rules/*.md`)

- New path-scoped modules that need their own rules file
- New banned patterns that should be enforced
- Updates to existing rules based on what was learned

### 2d. Docs drift (`docs/ARCHITECTURE.md`, `docs/VISION.md`)

- **Folder Structure** section — new dirs/files
- **Stack** table — new deps + versions
- **API Surface** — new endpoints
- **Testing Strategy** — new file conventions
- **Day-N Checklist** items that are now done
- **Hard-Won Lessons** — add any from this sprint's gotchas

### 2e. TASKS.md housekeeping

- Append a one-liner to `## Completed Sprints` (e.g., *"Sprint 1 — Setup: Next.js scaffold, deps, shadcn, supabase init, vitest smoke"*)
- Clear the `## Current:` block (leave the heading, ready for next sprint plan)
- Session log already captures session-level events — leave or trim to last 3 entries

**Done when:** candidate list is enumerated with rationale, covering all five categories (skip categories that truly have nothing).

## Phase 3: Propose to user

Print a structured proposal. Be terse — one-line-per-item. Example:

```
## Sprint 1 wrap-up proposal

### Memory (3)
1. [semantic, imp 0.7] pnpm v10 build-script approval — `onlyBuiltDependencies` in `pnpm-workspace.yaml` for supabase CLI postinstall
2. [procedural, imp 0.65] shadcn init for Tailwind 4 — `pnpm dlx shadcn@latest init -d -y` works; validates Tailwind v4 automatically
3. [pattern, imp 0.5] vitest smoke test convention — `__tests__/*.vitest.ts`, include-glob in vitest.config.ts

### CLAUDE.md updates (1)
1. Section Stack — add `shadcn/ui` (Radix-wrapped, CSS vars)

### Rules updates (0)
(none)

### Docs drift (2)
1. docs/ARCHITECTURE.md § Stack — add `shadcn/ui`, correct React version to 19.2.4
2. docs/ARCHITECTURE.md § Day-1 Checklist — mark the items we completed

### TASKS.md
- Add to Completed Sprints: "Sprint 1 — Setup: Next.js scaffold + deps + shadcn + supabase init"
- Clear Current: section (ready for next sprint)

Reply with: `all` | `1,3,5,…` (numbers) | `skip` | `cancel` | inline edits.
```

Wait for user reply. If unclear → ask a clarifying question via AskUserQuestion.

**Done when:** user has explicitly approved a set of items (or said `skip`/`cancel`).

## Phase 4: Execute approved items

Apply ONLY what was approved. For each item:
- **Memory:** `memory_search` once more to confirm no duplicate landed, then `memory_store` with the approved type/importance/tags.
- **CLAUDE.md / rules / docs:** use `Edit` tool with exact old/new strings. If edit fails (context mismatch), surface the error — do not attempt auto-merge.
- **TASKS.md:** edit the Completed Sprints list and clear the Current section.

Batch where tools allow (parallel `memory_store` calls in one message; parallel `Edit` calls across files).

**Done when:** all approved actions complete; log of what was applied printed to the user.

## Phase 5: Verify

1. `git status --porcelain` — show the user which files changed.
2. Quick sanity-search: for each new memory, run `memory_search` with its title to confirm it's retrievable.
3. Recommend next steps:
   - Commit the doc/rule updates (`git add -p; git commit -m "chore: wrap sprint N, capture learnings"`)
   - Open Sprint N+1 by pulling items from `BACKLOG.md` into `TASKS.md`

**Done when:** user sees a clean close and knows what to do next.

## Edge cases

- **Uncommitted work exists** → abort: *"Commit or stash in-flight changes first; wrap-up will propose edits and needs a clean tree."*
- **Sprint not fully complete** → abort as stated in preconditions.
- **No commits since last sprint** → minimal wrap (just TASKS.md housekeeping); skip memory/doc harvest.
- **First sprint, no prior marker** → use the initial commit as lower bound.
- **User explicitly declines all candidates** → only do TASKS.md housekeeping, confirm with a one-line summary.

## Non-goals

- Not a code review (that's the `code-reviewer` subagent, at commit time).
- Not automatic — user must invoke. A sister hook in `settings.json` nudges toward `/wrap-sprint` when the last WP is ticked.
- Not a replacement for real planning — wrap-up closes the past sprint only; opening the next sprint is a separate conversation.
