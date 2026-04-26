#!/usr/bin/env bash
# Sprint-open hygiene check
#
# Fires on every `git commit` Bash call. Catches the case where TASKS.md
# gains a new `## Current: Sprint N` block but BACKLOG.md has no staged
# deletions, i.e. the "remove pulled WPs from BACKLOG in the same edit"
# rule from CLAUDE.md was skipped.
#
# Non-blocking by design: warns loudly in the pre-commit output so the
# author notices, but exits 0. Over-blocking on sprint mechanics during
# the hackathon window would risk a bad-moment interrupt. The warning is
# prominent enough that it won't be missed by a reviewer.

set -u
cmd="${TOOL_INPUT_COMMAND:-}"

# Only act on `git commit`, word-boundary match so commits inside
# strings / subshells don't trigger.
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || exit 0

# Nothing staged → let git emit its own "nothing to commit" message.
git diff --cached --quiet 2>/dev/null && exit 0

# Is TASKS.md staged?
git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -q '^TASKS\.md$' || exit 0

# Does the staged TASKS.md diff ADD a new `## Current: Sprint N` block?
# Matches on `+## Current: Sprint` at line start in diff output.
new_sprint=$(git diff --cached TASKS.md 2>/dev/null | grep -cE '^\+## Current: Sprint [0-9]+')
[ "$new_sprint" -eq 0 ] && exit 0

# If a new sprint was opened, BACKLOG.md should have net deletions (pulled
# WPs removed). Count lines that start with `-` but not `---` (diff header).
backlog_deletions=$(git diff --cached BACKLOG.md 2>/dev/null | grep -cE '^-[^-]')
if [ "$backlog_deletions" -eq 0 ]; then
  echo ""
  echo "⚠️  WARNING: sprint-open hygiene"
  echo ""
  echo "TASKS.md stages a new '## Current: Sprint ...' block, but BACKLOG.md"
  echo "has no staged deletions."
  echo ""
  echo "Per CLAUDE.md: 'When a WP is pulled from BACKLOG.md into a sprint,"
  echo "remove it from BACKLOG.md in the same edit.' Overlap = drift."
  echo ""
  echo "If you opened a fresh-scope sprint with no BACKLOG pulls, ignore"
  echo "this. Otherwise scrub BACKLOG.md before committing."
  echo ""
fi

exit 0
