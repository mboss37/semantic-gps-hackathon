'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CircleCheckIcon,
  CircleXIcon,
  KeyRoundIcon,
  Loader2Icon,
  PlugZapIcon,
  ServerIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyButton } from '@/components/dashboard/copy-button';
import {
  TOKEN_PLACEHOLDER,
  anthropicSdkSnippet,
  claudeDesktopSnippet,
  curlSnippet,
  inspectorSnippet,
  type SnippetInput,
} from '@/lib/connect/snippets';

type DomainRow = { slug: string; name: string };
type ServerRow = { id: string; name: string; transport: string };
type TokenRow = { id: string; name: string };

type Tier = 'org' | 'domain' | 'server';

type Props = {
  domains: DomainRow[];
  servers: ServerRow[];
  tokens: TokenRow[];
};

const slugify = (input: string): string => {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'semantic-gps';
};

const resolveOrigin = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.length > 0) return envUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

export const ConnectPanel = ({ domains, servers, tokens }: Props) => {
  const [tier, setTier] = useState<Tier>('org');
  const [domainSlug, setDomainSlug] = useState<string>(domains[0]?.slug ?? '');
  const [serverId, setServerId] = useState<string>(servers[0]?.id ?? '');
  const [pasteToken, setPasteToken] = useState<string>('');
  const [testState, setTestState] = useState<
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'ok'; toolCount: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const origin = resolveOrigin();

  const endpointPath = useMemo(() => {
    if (tier === 'org') return '/api/mcp';
    if (tier === 'domain') {
      if (!domainSlug) return '/api/mcp/domain/<select-a-domain>';
      return `/api/mcp/domain/${domainSlug}`;
    }
    if (!serverId) return '/api/mcp/server/<select-a-server>';
    return `/api/mcp/server/${serverId}`;
  }, [tier, domainSlug, serverId]);

  const endpoint = useMemo(() => `${origin}${endpointPath}`, [endpointPath, origin]);

  const selectedServer = servers.find((s) => s.id === serverId);
  const selectedDomain = domains.find((d) => d.slug === domainSlug);

  const serverSlug = useMemo(() => {
    if (tier === 'server' && selectedServer) return slugify(selectedServer.name);
    if (tier === 'domain' && selectedDomain) return slugify(selectedDomain.name);
    return 'semantic-gps';
  }, [tier, selectedServer, selectedDomain]);

  const snippetInput: SnippetInput = {
    endpoint,
    token: pasteToken.length > 0 ? pasteToken : TOKEN_PLACEHOLDER,
    serverSlug,
  };

  const tierReady =
    tier === 'org' ||
    (tier === 'domain' && domainSlug.length > 0) ||
    (tier === 'server' && serverId.length > 0);

  const onTest = async () => {
    if (pasteToken.length === 0) {
      toast.error('Paste a gateway token first');
      return;
    }
    setTestState({ kind: 'pending' });
    try {
      const res = await fetch(endpointPath, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pasteToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      if (!res.ok) {
        setTestState({ kind: 'error', message: `HTTP ${res.status}` });
        return;
      }
      const text = await res.text();
      const jsonStart = text.indexOf('{');
      const parsed = jsonStart >= 0 ? JSON.parse(text.slice(jsonStart)) : { result: { tools: [] } };
      const tools = parsed?.result?.tools;
      const count = Array.isArray(tools) ? tools.length : 0;
      setTestState({ kind: 'ok', toolCount: count });
    } catch (err) {
      setTestState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ScopeBar
        tier={tier}
        onTierChange={setTier}
        domains={domains}
        servers={servers}
        domainSlug={domainSlug}
        serverId={serverId}
        onDomainChange={setDomainSlug}
        onServerChange={setServerId}
      />

      <EndpointRow endpoint={endpoint} />

      <TestRow
        tokens={tokens}
        pasteToken={pasteToken}
        setPasteToken={setPasteToken}
        onTest={onTest}
        canTest={tierReady && pasteToken.length > 0 && testState.kind !== 'pending'}
        testState={testState}
      />

      <SnippetTabs snippetInput={snippetInput} />
    </div>
  );
};

type ScopeBarProps = {
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  domains: DomainRow[];
  servers: ServerRow[];
  domainSlug: string;
  serverId: string;
  onDomainChange: (slug: string) => void;
  onServerChange: (id: string) => void;
};

const ScopeBar = ({
  tier,
  onTierChange,
  servers,
  serverId,
  onServerChange,
}: ScopeBarProps) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:gap-4">
    <Tabs value={tier} onValueChange={(v) => onTierChange(v as Tier)}>
      <TabsList>
        <TabsTrigger value="org">Org-wide</TabsTrigger>
        <TabsTrigger value="domain" disabled className="gap-1.5">
          Domain
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
            Soon
          </span>
        </TabsTrigger>
        <TabsTrigger value="server">Server</TabsTrigger>
      </TabsList>
    </Tabs>

    {tier === 'server' ? (
      servers.length === 0 ? (
        <Link
          href="/dashboard/servers"
          className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
        >
          <ServerIcon className="size-3.5" /> Register your first server
        </Link>
      ) : (
        <Select value={serverId} onValueChange={onServerChange}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select a server" />
          </SelectTrigger>
          <SelectContent>
            {servers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}{' '}
                <span className="text-xs text-muted-foreground">({s.transport})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    ) : null}
  </div>
);

const EndpointRow = ({ endpoint }: { endpoint: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
    <span className="truncate font-mono text-sm">{endpoint}</span>
    <CopyButton value={endpoint} label="Copy URL" />
  </div>
);

type SnippetTabsProps = { snippetInput: SnippetInput };

const SnippetTabs = ({ snippetInput }: SnippetTabsProps) => (
  <Tabs defaultValue="curl">
    <TabsList>
      <TabsTrigger value="curl">curl</TabsTrigger>
      <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
      <TabsTrigger value="inspector">MCP Inspector</TabsTrigger>
      <TabsTrigger value="sdk">Anthropic SDK</TabsTrigger>
    </TabsList>
    <SnippetBlock value="curl" code={curlSnippet(snippetInput)} />
    <SnippetBlock value="claude" code={claudeDesktopSnippet(snippetInput)} />
    <SnippetBlock value="inspector" code={inspectorSnippet(snippetInput)} />
    <SnippetBlock value="sdk" code={anthropicSdkSnippet(snippetInput)} />
  </Tabs>
);

const SnippetBlock = ({ value, code }: { value: string; code: string }) => (
  <TabsContent value={value} className="mt-3">
    <div className="relative rounded-lg border bg-muted/40">
      <div className="absolute right-2 top-2">
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-3 pr-20 font-mono text-xs leading-relaxed">{code}</pre>
    </div>
  </TabsContent>
);

type TestRowProps = {
  tokens: TokenRow[];
  pasteToken: string;
  setPasteToken: (v: string) => void;
  onTest: () => Promise<void>;
  canTest: boolean;
  testState:
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'ok'; toolCount: number }
    | { kind: 'error'; message: string };
};

const TestRow = ({ tokens, pasteToken, setPasteToken, onTest, canTest, testState }: TestRowProps) => (
  <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
    <span className="text-xs text-muted-foreground">
      {tokens.length === 0
        ? 'No tokens yet — mint one to authenticate any client. Or paste an existing plaintext below to test live; it stays in your browser.'
        : 'Test live with one of your tokens. Paste plaintext below — it stays in your browser and never re-renders into snippets unless you choose.'}
    </span>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onTest();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <Input
        value={pasteToken}
        onChange={(e) => setPasteToken(e.target.value)}
        placeholder="sgps_…"
        type="password"
        autoComplete="off"
        spellCheck={false}
        aria-label="Gateway token"
        className="max-w-md flex-1 font-mono"
      />
      <Button type="submit" disabled={!canTest}>
        {testState.kind === 'pending' ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <PlugZapIcon className="size-3.5" />
        )}
        Test connection
      </Button>
      <Button asChild variant="outline">
        <Link href="/dashboard/tokens">
          <KeyRoundIcon className="size-3.5" />
          Mint token
        </Link>
      </Button>
      {testState.kind === 'ok' ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
          <CircleCheckIcon className="size-3.5" />
          {testState.toolCount} tool{testState.toolCount === 1 ? '' : 's'}
        </span>
      ) : null}
      {testState.kind === 'error' ? (
        <span className="inline-flex items-center gap-1 text-xs text-red-500">
          <CircleXIcon className="size-3.5" />
          {testState.message}
        </span>
      ) : null}
    </form>
  </div>
);
