'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/dashboard/copy-button';

// Judge-facing copy-paste block. Embeds the gateway URL for this server but
// NEVER a real token — the `<YOUR_GATEWAY_TOKEN — …>` placeholder is
// intentional so a screen recording can't leak a bearer.
// Origin resolution: useSyncExternalStore reads window.location.origin on
// hydration so the snippet always reflects the host the user is actually on
// (localhost in dev, Vercel domain on hosted, tunnel only when on the tunnel).
// Sprint 25 fix — NEXT_PUBLIC_APP_URL was a stale-tunnel footgun.

type Props = {
  serverId: string;
  serverName: string;
};

const slugify = (input: string): string => {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'server';
};

// useSyncExternalStore needs a subscribe fn even for static browser values.
// origin doesn't change after mount, so the subscriber is a no-op.
const subscribeNoop = () => () => {};

export const ServerConfigSnippet = ({ serverId, serverName }: Props) => {
  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  );

  const snippet = useMemo(() => {
    const url = origin.length > 0
      ? `${origin}/api/mcp/server/${serverId}`
      : `/api/mcp/server/${serverId}`;
    const config = {
      mcpServers: {
        [slugify(serverName)]: {
          transport: 'http-streamable',
          url,
          headers: {
            Authorization: 'Bearer <YOUR_GATEWAY_TOKEN — mint at /dashboard/tokens>',
          },
        },
      },
    };
    return JSON.stringify(config, null, 2);
  }, [serverId, serverName, origin]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-sm">MCP client config</CardTitle>
            <CardDescription>
              Paste into Claude Desktop / Cursor / any MCP client. Token placeholder is
              intentional — mint one at{' '}
              <a href="/dashboard/tokens" className="underline underline-offset-2">
                /dashboard/tokens
              </a>
              .
            </CardDescription>
          </div>
          <CopyButton value={snippet} />
        </div>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {snippet}
        </pre>
      </CardContent>
    </Card>
  );
};
