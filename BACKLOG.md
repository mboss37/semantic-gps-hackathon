# claude-hackathon - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

## [P1] README replacement — do after first real feature lands
Default CNA `README.md` still in repo. Required for submission but pointless to write before there's a real quickstart to document. Revisit once auth + gateway skeleton exists.

- [ ] Replace with project README — quickstart, env setup, deploy link, demo video embed (video slots in Day 5). **Required for submission.**

## [P1] Replace CNA landing before demo
Create-Next-App's defaults leak "Create Next App" branding. Judges see the tab title. Fix before Saturday.

- [ ] `app/layout.tsx` — replace metadata (`title: "Create Next App"`, description)
- [ ] `app/page.tsx` — replace marketing page with the Semantic GPS landing (or redirect to `/dashboard`)

## [P2] GitHub repo metadata polish — check before demo
Repo topics + license + branch protection done in Sprint 1. Remaining polish for submission credibility.

- [ ] Repo About section — short description ("MCP control plane for agentic workflows — hackathon build") + website URL (Vercel deploy)
- [ ] Social preview image — 1280×640 og-image so link unfurls look professional on X / Slack / Discord
- [ ] Verify `LICENSE` renders correctly on GitHub (should show the license type in the About panel)
- [ ] Verify repo description + topics still match final scope after build

## [P2] Cosmetic cleanup
- [ ] `components/ui/button.tsx` — shadcn ships without semicolons; our `.prettierrc` wants them. Run `pnpm exec prettier --write components/ui` to normalize next time it's touched.

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
