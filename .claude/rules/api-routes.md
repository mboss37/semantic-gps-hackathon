---
paths: ["app/api/**"]
---

# API Route Handler Rules

- Validate input with **`zod.safeParse()`**, never `.parse()` (crashes on bad input)
- On validation failure, return 400 with `result.error.flatten()`
- `z.coerce.number()` for query params, `z.coerce.boolean()` for flags
- Catch variables are `unknown`, narrow with `e instanceof Error ? e.message : String(e)`
- `export const dynamic = 'force-dynamic'` on GET handlers returning user-specific data
- `await params`, Next.js 16 route params are async
- Use `lib/supabase/server.ts` (user-scoped) in any route with a session
- Use `lib/supabase/service.ts` (service role) **ONLY** in `app/api/mcp/route.ts`
- **Org-scope every query.** `requireAuth()` returns `organization_id`. All `servers` / `tools` / `relationships` / `policies` reads + writes must filter by that org (`.eq('organization_id', organization_id)` on reads, include it on inserts). Cross-org data leaks start here.
- Check Supabase `{ error }`, errors are returned, not thrown
- `.single()` only when exactly one row is expected; otherwise `.maybeSingle()`
- Never expose internal error details in responses, return typed error codes
- Keep handlers under 50 lines; extract logic to `lib/`
