import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, ShieldAlertIcon, WrenchIcon, LinkIcon, BookIcon } from 'lucide-react';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { fetchServerDetail, fetchRemoteCapabilities } from '@/lib/servers/fetch';
import { ServerConfigSnippet } from '@/components/dashboard/server-config-snippet';
import { ServerHealthBadge } from '@/components/dashboard/server-health-badge';
import { ServerRediscoverButton } from '@/components/dashboard/server-rediscover-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

type Params = { id: string };

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

  // `detail.authConfig` is the raw server-only field exposed by
  // fetchServerDetail for this capabilities call. It never reaches any
  // Client Component (see the type's JSDoc in lib/servers/fetch.ts).
  const capabilities = await fetchRemoteCapabilities({
    transport: detail.server.transport,
    origin_url: detail.server.origin_url,
    auth_config: detail.authConfig,
  });

  const createdAt = new Date(detail.server.created_at).toLocaleDateString();
  const totalViolations = detail.violationsByPolicy.reduce((acc, v) => acc + v.count, 0);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Link
          href="/dashboard/servers"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All servers
        </Link>
      </div>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold">{detail.server.name}</h1>
            <Badge variant="outline" className="shrink-0">
              {detail.server.transport}
            </Badge>
            {detail.server.has_auth ? (
              <Badge variant="secondary" className="shrink-0">auth configured</Badge>
            ) : null}
          </div>
          {detail.server.origin_url ? (
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {detail.server.origin_url}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {detail.tools.length} {detail.tools.length === 1 ? 'tool' : 'tools'} · registered {createdAt}
          </p>
        </div>
        <ServerRediscoverButton serverId={detail.server.id} />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column: tools + violations */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <WrenchIcon className="size-4" />
                Tools
              </CardTitle>
              <CardDescription>
                Callable through the gateway at <code>/api/mcp/server/{detail.server.id}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.tools.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tools discovered — origin may be unreachable.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {detail.tools.map((t) => (
                    <li key={t.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                      <div className="flex items-baseline gap-2">
                        <code className="font-mono text-xs">{t.name}</code>
                        {t.display_name && t.display_name !== t.name ? (
                          <span className="text-xs text-muted-foreground">
                            {t.display_name}
                          </span>
                        ) : null}
                      </div>
                      {t.description ? (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlertIcon className="size-4" />
                Policy blocks · 7d
              </CardTitle>
              <CardDescription>
                Counts of <code>blocked_by_policy</code> events per policy, last 7 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalViolations === 0 ? (
                <p className="text-xs text-muted-foreground">No policy blocks in 7d.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {detail.violationsByPolicy.map((v) => {
                    const maxCount = detail.violationsByPolicy[0]?.count ?? 1;
                    const widthPct = Math.max(4, Math.round((v.count / maxCount) * 100));
                    return (
                      <li key={v.policy_name} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs">{v.policy_name}</span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {v.count}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-destructive/60"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: config snippet + remote capabilities + origin health */}
        <div className="flex flex-col gap-4">
          <ServerConfigSnippet serverId={detail.server.id} serverName={detail.server.name} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <LinkIcon className="size-4" />
                Resources
              </CardTitle>
              <CardDescription>Origin MCP <code>resources/list</code>.</CardDescription>
            </CardHeader>
            <CardContent>
              {capabilities.resources === null ? (
                <p className="text-xs text-muted-foreground">(not supported by origin)</p>
              ) : capabilities.resources.length === 0 ? (
                <p className="text-xs text-muted-foreground">(none)</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {capabilities.resources.map((r) => (
                    <li key={r.uri} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                      <code className="font-mono text-xs">{r.name}</code>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.uri}
                      </span>
                      {r.description ? (
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookIcon className="size-4" />
                Prompts
              </CardTitle>
              <CardDescription>Origin MCP <code>prompts/list</code>.</CardDescription>
            </CardHeader>
            <CardContent>
              {capabilities.prompts === null ? (
                <p className="text-xs text-muted-foreground">(not supported by origin)</p>
              ) : capabilities.prompts.length === 0 ? (
                <p className="text-xs text-muted-foreground">(none)</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {capabilities.prompts.map((p) => (
                    <li key={p.name} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                      <code className="font-mono text-xs">{p.name}</code>
                      {p.description ? (
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Origin status</CardTitle>
            </CardHeader>
            <CardContent>
              <ServerHealthBadge serverId={detail.server.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ServerDetailPage;
