'use client';

import { useMemo, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Judge-facing copy-paste block. Embeds the gateway URL for this server but
// NEVER a real token — the placeholder `<YOUR_GATEWAY_TOKEN — …>` is
// intentional so a screen recording can't leak a bearer. URL resolution:
//   1. NEXT_PUBLIC_APP_URL if set at build time
//   2. otherwise fall back to window.location.origin at first render
// Server-render picks up #1 or renders `""` (no origin) until the client
// hydrates — the `useMemo` re-computes once `window` exists.

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

const resolveOrigin = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

export const ServerConfigSnippet = ({ serverId, serverName }: Props) => {
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    const origin = resolveOrigin();
    const url = origin.length > 0 ? `${origin}/api/mcp/server/${serverId}` : `/api/mcp/server/${serverId}`;
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
  }, [serverId, serverName]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed — select manually');
    }
  };

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
          <Button variant="secondary" size="sm" onClick={() => void onCopy()}>
            {copied ? (
              <>
                <CheckIcon className="size-3.5" />
                Copied!
              </>
            ) : (
              <>
                <CopyIcon className="size-3.5" />
                Copy
              </>
            )}
          </Button>
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
