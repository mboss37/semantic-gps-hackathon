import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  WaypointsIcon,
} from 'lucide-react';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchLatestRouteRun, fetchRouteDetail } from '@/lib/routes/fetch';
import { RouteTimeline } from '@/components/dashboard/route-timeline';
import { Card, CardContent } from '@/components/ui/card';

// Sprint 28 redesign: detail view drops the React Flow canvas entirely.
// Routes are linear procedures, so they're presented as a vertical
// timeline (CI/CD shape — Vercel deployments, GitHub Actions). The
// graph viz at /dashboard/graph stays the home for relationship topology.

export const dynamic = 'force-dynamic';

type Params = { id: string };

const STATUS_TONE: Record<string, { color: string; label: string; Icon: typeof CircleCheckIcon }> = {
  ok: { color: '#34d399', label: 'Succeeded', Icon: CircleCheckIcon },
  origin_error: { color: '#ef4444', label: 'Halted', Icon: CircleAlertIcon },
  fallback_triggered: { color: '#60a5fa', label: 'Fallback', Icon: WaypointsIcon },
  rollback_executed: { color: '#f97316', label: 'Rolled back', Icon: CircleAlertIcon },
};

const formatRelative = (iso: string): string => {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - target;
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

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
          <p className="text-sm text-muted-foreground">Sign in to view this route.</p>
        </div>
      );
    }
    throw e;
  }

  const [route, latestRun] = await Promise.all([
    fetchRouteDetail(supabase, organization_id, id),
    fetchLatestRouteRun(supabase, organization_id, id),
  ]);
  if (!route) notFound();

  const tone = latestRun ? STATUS_TONE[latestRun.status] : null;
  const StatusIcon = tone?.Icon ?? ClockIcon;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <Link
        href="/dashboard/routes"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        All routes
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{route.name}</h1>
            {route.description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{route.description}</p>
            ) : null}
          </div>
          {latestRun ? (
            <Link
              href={`/dashboard/audit?trace_id=${latestRun.trace_id}`}
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs transition-colors hover:bg-muted/60"
            >
              <span className="font-mono uppercase tracking-wider">View latest execution</span>
              <ArrowRightIcon className="size-3" />
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">
            {route.steps.length} {route.steps.length === 1 ? 'step' : 'steps'}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="font-mono">read-only · authoring via migrations</span>
          {latestRun ? (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
                style={
                  tone
                    ? {
                        borderColor: `${tone.color}4d`,
                        backgroundColor: `${tone.color}14`,
                        color: tone.color,
                      }
                    : undefined
                }
              >
                <StatusIcon className="size-3" />
                <span className="font-mono uppercase tracking-wider">
                  {tone?.label ?? latestRun.status}
                </span>
                <span className="text-foreground/70">{formatRelative(latestRun.created_at)}</span>
                {latestRun.latency_ms !== null && (
                  <span className="text-foreground/70">· {latestRun.latency_ms}ms</span>
                )}
              </span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-mono">No runs in the last 24h</span>
            </>
          )}
        </div>
      </header>

      {route.steps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This route has no steps.
          </CardContent>
        </Card>
      ) : (
        <RouteTimeline steps={route.steps} />
      )}
    </div>
  );
};

export default RouteDetailPage;
