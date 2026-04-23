import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchRouteDetail } from '@/lib/routes/fetch';
import { RouteCanvas } from '@/components/dashboard/route-canvas';

export const dynamic = 'force-dynamic';

type Params = { id: string };

const RouteDetailPage = async ({ params }: { params: Promise<Params> }) => {
  const { id } = await params;

  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return (
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm text-zinc-400">Sign in to view this route.</p>
        </div>
      );
    }
    throw e;
  }

  const route = await fetchRouteDetail(supabase, organization_id, id);
  if (!route) notFound();

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Link
          href="/dashboard/routes"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeftIcon className="size-3.5" />
          All routes
        </Link>
      </div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{route.name}</h1>
          {route.description ? (
            <p className="mt-1 text-sm text-zinc-400">{route.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">
            {route.steps.length} {route.steps.length === 1 ? 'step' : 'steps'} · read-only view ·
            create/edit via migrations
          </p>
        </div>
      </header>

      {route.steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">This route has no steps.</p>
        </div>
      ) : (
        <RouteCanvas steps={route.steps} />
      )}
    </div>
  );
};

export default RouteDetailPage;
