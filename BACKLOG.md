# claude-hackathon - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

## [P0] GitHub remote setup — blocked on remote URL
Do the moment the remote is known. Everything downstream (CI, deploys, branch protection, review on PRs) depends on it.

- [ ] `git remote add origin <url>` + `git push -u origin main`
- [ ] Make repo **public** (hackathon rules require OSS visibility)
- [ ] Enable branch protection on `main` — require CI green, no direct push to `main`
- [ ] Verify `.github/workflows/ci.yml` runs green on first push
- [ ] Add repo description + topics (`mcp`, `agents`, `nextjs`, `claude`, `opus-4-7`) for judge discoverability
- [ ] Add `README.md` with quickstart, deploy link, demo video embed (required for submission)

## [P0] Vercel deploy — blocked on remote
Auto-deploy main to a stable URL so the dashboard has a live home from day 1.

- [ ] Link Vercel project to GitHub repo (auto-deploy on push)
- [ ] Install Supabase Marketplace integration on Vercel (auto-injects `NEXT_PUBLIC_SUPABASE_URL`, anon key, service role)
- [ ] Add `ANTHROPIC_API_KEY` and `CREDENTIALS_ENCRYPTION_KEY` to Vercel project settings
- [ ] Verify first preview deploy renders landing page

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
