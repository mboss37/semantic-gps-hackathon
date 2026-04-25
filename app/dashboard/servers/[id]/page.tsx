import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeftIcon,
  BookIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  LinkIcon,
  TriangleAlertIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchServerDetail, fetchRemoteCapabilities } from '@/lib/servers/fetch';
import { probeServerOrigin, type HealthStatus } from '@/lib/servers/health';
import { CopyButton } from '@/components/dashboard/copy-button';
import { ServerRediscoverButton } from '@/components/dashboard/server-rediscover-button';
import { ServerToolsTable } from '@/components/dashboard/server-tools-table';

// Sprint 26 — server detail = REGISTRATION + DRILL-DOWN. The list-page card
// already shows identity, health, tool count, and chips. The detail page
// earns its click by exposing what the card cannot:
//   • per-tool drill — full description, display rewrite, input JSON Schema
//   • per-tool 24h calls + errors
//   • configuration block — origin URL, transport, auth, registered date
//   • remote capabilities (resources/prompts) live from origin

export const dynamic = 'force-dynamic';

type Params = { id: string };

const HEALTH_LABEL: Record<HealthStatus, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unprobed',
};

const HEALTH_BADGE_CLASS: Record<HealthStatus, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  down: 'border-red-500/30 bg-red-500/10 text-red-300',
  unknown: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
};

const HealthIcon = ({ status }: { status: HealthStatus }) => {
  if (status === 'ok') return <CheckCircle2Icon className="size-3.5" />;
  if (status === 'degraded') return <TriangleAlertIcon className="size-3.5" />;
  if (status === 'down') return <XCircleIcon className="size-3.5" />;
  return <CircleHelpIcon className="size-3.5" />;
};

const ServerDetailPage = async ({ params }: { params: Promise<Params> }) => {
  const { id } = await params;

  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return (
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm text-muted-foreground">Sign in to view this server.</p>
        </div>
      );
    }
    throw e;
  }

  const detail = await fetchServerDetail(supabase, organization_id, id);
  if (!detail) notFound();

  const [probe, capabilities] = await Promise.all([
    probeServerOrigin(detail.server.origin_url),
    fetchRemoteCapabilities({
      transport: detail.server.transport,
      origin_url: detail.server.origin_url,
      auth_config: detail.authConfig,
    }),
  ]);

  const registered = new Date(detail.server.created_at).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const hasResources = !!capabilities.resources && capabilities.resources.length > 0;
  const hasPrompts = !!capabilities.prompts && capabilities.prompts.length > 0;
  const showCapabilities = hasResources || hasPrompts;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <Link
          href="/dashboard/servers"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All servers
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{detail.server.name}</h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${HEALTH_BADGE_CLASS[probe.status]}`}
            title={HEALTH_LABEL[probe.status]}
          >
            <HealthIcon status={probe.status} />
            {HEALTH_LABEL[probe.status]}
            {probe.status !== 'unknown' ? (
              <span className="font-mono text-[10px] opacity-80">{probe.latencyMs}ms</span>
            ) : null}
          </span>
        </div>
        <ServerRediscoverButton serverId={detail.server.id} />
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium tracking-tight">Configuration</h2>
        </div>
        <dl className="divide-y divide-border/40 rounded-md border border-border/60 bg-card/30">
          <ConfigRow label="Origin URL">
            {detail.server.origin_url ? (
              <>
                <span className="min-w-0 truncate font-mono text-xs text-foreground/90">
                  {detail.server.origin_url}
                </span>
                <CopyButton value={detail.server.origin_url} compact />
              </>
            ) : (
              <span className="text-xs text-muted-foreground/70">—</span>
            )}
          </ConfigRow>
          <ConfigRow label="Transport">
            <span className="font-mono text-xs text-foreground/90">{detail.server.transport}</span>
          </ConfigRow>
          <ConfigRow label="Auth">
            <span className="font-mono text-xs text-foreground/90">
              {detail.server.has_auth ? 'configured' : 'none'}
            </span>
          </ConfigRow>
          <ConfigRow label="Registered">
            <span className="text-xs text-foreground/90">{registered}</span>
          </ConfigRow>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <WrenchIcon className="size-3.5 translate-y-[1px] text-muted-foreground" />
            <h2 className="text-sm font-medium tracking-tight">Tools</h2>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {detail.tools.length}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click a row to inspect the input schema · 24h call counts on the right
          </p>
        </div>
        <ServerToolsTable tools={detail.tools} />
      </section>

      {showCapabilities ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium tracking-tight">Other surfaces</h2>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {(capabilities.resources?.length ?? 0) + (capabilities.prompts?.length ?? 0)}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {hasResources ? (
              <CapabilityCard icon={<LinkIcon className="size-3.5" />} label="Resources">
                <ul className="divide-y divide-border/40">
                  {capabilities.resources?.map((r) => (
                    <li key={r.uri} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                      <code className="font-mono text-xs">{r.name}</code>
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {r.uri}
                      </span>
                      {r.description ? (
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CapabilityCard>
            ) : null}
            {hasPrompts ? (
              <CapabilityCard icon={<BookIcon className="size-3.5" />} label="Prompts">
                <ul className="divide-y divide-border/40">
                  {capabilities.prompts?.map((p) => (
                    <li key={p.name} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                      <code className="font-mono text-xs">{p.name}</code>
                      {p.description ? (
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CapabilityCard>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};

type ConfigRowProps = {
  label: string;
  children: React.ReactNode;
};

const ConfigRow = ({ label, children }: ConfigRowProps) => (
  <div className="grid grid-cols-[120px_1fr] items-center gap-4 px-4 py-2.5">
    <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </dt>
    <dd className="flex min-w-0 items-center gap-2">{children}</dd>
  </div>
);

type CapabilityCardProps = {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
};

const CapabilityCard = ({ icon, label, children }: CapabilityCardProps) => (
  <div className="rounded-md border border-border/60 bg-card/30 p-4">
    <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      {icon}
      {label}
    </div>
    {children}
  </div>
);

export default ServerDetailPage;
