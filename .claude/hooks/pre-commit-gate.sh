#!/usr/bin/env bash
# Pre-commit quality gate
# Blocks git commit if: no code-reviewer marker, tsc fails, lint fails, or tests fail.
# Only gates when TypeScript files are staged. Docs/config-only commits pass through.

set -u
cmd="${TOOL_INPUT_COMMAND:-}"

# Only act on `git commit` — match word boundaries, ignore commits in subshells / piped output
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || exit 0

# Nothing staged → let git handle the "nothing to commit" message itself
git diff --cached --quiet 2>/dev/null && exit 0

# Staged TypeScript files?
staged_ts=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|tsx)$' | head -1)
if [ -z "$staged_ts" ]; then
  # Docs / config-only — skip the code gate
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
[ -z "$repo_root" ] && exit 0
cd "$repo_root" || exit 0

# 1. Code-reviewer marker must exist for current staged diff
diff_hash=$(git diff --cached 2>/dev/null | shasum -a 256 | cut -c1-16)
marker=".claude/state/last-review-${diff_hash}"
if [ ! -f "$marker" ]; then
  echo "BLOCKED: pre-commit gate"
  echo ""
  echo "TypeScript changes are staged but no code-reviewer approval exists for this diff."
  echo ""
  echo "Next step:"
  echo "  Spawn the code-reviewer subagent via the Agent tool (subagent_type: code-reviewer)."
  echo "  On approval it writes .claude/state/last-review-${diff_hash}, then retry the commit."
  exit 1
fi

# 2. Type check
if ! pnpm exec tsc --noEmit >/tmp/.tsc-out 2>&1; then
  echo "BLOCKED: pre-commit gate — type check failed"
  echo ""
  tail -30 /tmp/.tsc-out
  exit 1
fi

# 3. Lint
if ! pnpm lint >/tmp/.lint-out 2>&1; then
  echo "BLOCKED: pre-commit gate — lint failed"
  echo ""
  tail -30 /tmp/.lint-out
  exit 1
fi

# 4. Tests
if ! pnpm test >/tmp/.test-out 2>&1; then
  echo "BLOCKED: pre-commit gate — tests failed"
  echo ""
  tail -40 /tmp/.test-out
  exit 1
fi

exit 0
