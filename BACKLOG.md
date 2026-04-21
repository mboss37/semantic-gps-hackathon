# claude-hackathon - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

## [P0] GitHub remote setup
Partial — remote linked, repo is public. Finishing items below.

- [x] `git remote add origin <url>` + `git push -u origin main`
- [x] Make repo **public** (hackathon rules require OSS visibility)
- [ ] Enable branch protection on `main` — require CI green, no direct push to `main`
- [ ] Verify `.github/workflows/ci.yml` runs green on first real push (initial push expected to fail — no package.json at commit time)
- [ ] Add repo topics (`mcp`, `agents`, `nextjs`, `claude`, `opus-4-7`) for judge discoverability (description already set on create)
- [ ] Replace default `README.md` (CNA boilerplate) with project README — quickstart, deploy link, demo video embed. Required for submission.

## [P0] Vercel deploy — blocked on Day-5 prep or first real demo
Auto-deploy main to a stable URL so the dashboard has a live home from day 1.

- [ ] Link Vercel project to GitHub repo (auto-deploy on push)
- [ ] Install Supabase Marketplace integration on Vercel (auto-injects `NEXT_PUBLIC_SUPABASE_URL`, anon key, service role)
- [ ] Add `ANTHROPIC_API_KEY` and `CREDENTIALS_ENCRYPTION_KEY` to Vercel project settings
- [ ] Verify first preview deploy renders landing page

## [P1] Replace CNA boilerplate before demo
Create-Next-App's defaults leak "Create Next App" branding. Judges see the tab title. Fix before Saturday.

- [ ] `app/layout.tsx` — replace metadata (`title: "Create Next App"`, description)
- [ ] `app/page.tsx` — replace marketing page with the Semantic GPS landing (or redirect to `/dashboard`)

## [P2] Cosmetic cleanup
- [ ] `components/ui/button.tsx` — shadcn ships without semicolons; our `.prettierrc` wants them. Run `pnpm exec prettier --write components/ui` to normalize next time it's touched.

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
