import Link from 'next/link';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchOrgRoutes } from '@/lib/routes/fetch';

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
          <p className="text-sm text-zinc-400">Sign in to view Routes.</p>
        </div>
      );
    }
    throw e;
  }

  const routes = await fetchOrgRoutes(supabase, organization_id);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Routes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Deterministic tool chains with fallback + rollback. Click a route to inspect its steps
          and mappings. Authoring is migration-based today.
        </p>
      </header>

      {routes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">No routes yet.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Routes chain tools with fallbacks and rollbacks. Authoring lives in SQL migrations
            for this release — see{' '}
            <Link
              href="/dashboard/graph"
              className="text-zinc-200 underline underline-offset-2 hover:text-white"
            >
              Workflow Graph
            </Link>{' '}
            to explore the tools you can wire together.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/routes/${r.id}`}
              className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-indigo-600"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-zinc-100">{r.name}</h2>
                <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                  {r.step_count} {r.step_count === 1 ? 'step' : 'steps'}
                </span>
              </div>
              {r.description ? (
                <p className="text-xs text-zinc-400">{r.description}</p>
              ) : (
                <p className="text-xs text-zinc-600">No description.</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoutesPage;
