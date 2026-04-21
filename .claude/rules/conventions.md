# Project Conventions

- Use conventional commits (feat:, fix:, docs:, refactor:, test:, chore:)
- Keep files under 400 lines, functions under 50 lines
- Handle errors explicitly - no empty catch blocks
- Validate input at system boundaries

## Skill Authoring

When creating Claude Code skills (.claude/skills/*/SKILL.md):

- Keep SKILL.md under 500 lines — move reference material to supporting files in the same directory
- Front-load description (first 250 chars shown in listings) with TRIGGER when / DO NOT TRIGGER when clauses
- Add allowed-tools in frontmatter to restrict tool access (e.g. Read, Glob, Grep for read-only skills)
- Add argument-hint in frontmatter showing the expected input format (use $ARGUMENTS or $0, $1 for dynamic input)
- Set disable-model-invocation: true for skills with side effects (deploy, send messages)
- Structure as phases: Research, Plan, Execute, Verify with "Done when:" success criteria per phase
- Handle edge cases and preconditions before execution
