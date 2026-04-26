import Link from 'next/link';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchOrgRoutes, type RouteListItem } from '@/lib/routes/fetch';
import { Card, CardContent } from '@/components/ui/card';
import { RouteImportDialog } from '@/components/dashboard/route-import-dialog';

// Sprint 28 redesign: Routes catalog mirrors the chrome of `/dashboard/servers`
//, `<Card>` shell, `<CardContent flex flex-col gap-4>` body, identity row +
// description + stats footer. No bespoke hero, no marketing copy: this is an
// enterprise procedure list, not a tasting menu.

export const dynamic = 'force-dynamic';

const RoutesPage = async () => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return (
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm text-muted-foreground">Sign in to view Routes.</p>
        </div>
      );
    }
    throw e;
  }

  const routes = await fetchOrgRoutes(supabase, organization_id);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Routes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deterministic procedures composed of MCP tool calls. Each route binds a goal to a
            fixed sequence of steps, with optional fallback and saga-style rollback per step.
          </p>
        </div>
        <RouteImportDialog />
      </header>

      {routes.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No routes yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Routes chain tools with fallbacks and rollbacks. Authoring lives in SQL migrations
            for this release -{' '}
            <Link
              href="/dashboard/graph"
              className="text-foreground underline underline-offset-2 hover:text-foreground/80"
            >
              explore the workflow graph
            </Link>{' '}
            to see the tools you can wire together.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoutesPage;

const RouteCard = ({ route }: { route: RouteListItem }) => {
  const { runs, ok, errors } = route.stats_24h;

  return (
    <Link href={`/dashboard/routes/${route.id}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors hover:bg-accent/30 group-focus-visible:bg-accent/30">
        <CardContent className="flex flex-col gap-4">
          {/* Identity row, name on the left, step count on the right */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate font-mono text-[15px] font-medium tracking-tight">
              {route.name}
            </h3>
            <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {route.step_count} {route.step_count === 1 ? 'step' : 'steps'}
            </span>
          </div>

          {/* Description (clamp-2 keeps card height consistent across rows) */}
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {route.description ?? 'No description.'}
          </p>

          {/* Activity strip, same shape as server-card.tsx footer for visual parity */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            {runs === 0 ? (
              <span>No runs · 24h</span>
            ) : (
              <>
                <span>
                  <span className="text-foreground">{runs}</span> runs 24h
                </span>
                <span className="opacity-40" aria-hidden>·</span>
                <span className={errors > 0 ? 'text-amber-300' : ''}>
                  <span className={`${errors > 0 ? 'font-medium' : 'text-foreground'}`}>{ok}</span>{' '}
                  ok
                </span>
                <span className="opacity-40" aria-hidden>·</span>
                <span className={errors > 0 ? 'text-amber-300' : ''}>
                  <span className={`${errors > 0 ? 'font-medium' : 'text-foreground'}`}>
                    {errors}
                  </span>{' '}
                  err
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
