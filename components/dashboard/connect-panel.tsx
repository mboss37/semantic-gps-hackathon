'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/dashboard/code-block';
import { CopyButton } from '@/components/dashboard/copy-button';
import {
  TOKEN_PLACEHOLDER,
  anthropicSdkSnippet,
  claudeDesktopSnippet,
  curlSnippet,
  inspectorSnippet,
  type SnippetInput,
} from '@/lib/connect/snippets';

// Sprint 28 redesign: 4 stacked bespoke panels (each its own bg-muted/30
// rounded border) collapsed into ONE shadcn <Card>. Internal sections are
// labeled "1 · SCOPE / 2 · ENDPOINT / 3 · TEST / 4 · SNIPPET" with subtle
// uppercase mono headings — matches the disclosure pattern from the route
// timeline. Code shells now use the shared `<CodeBlock>` primitive instead
// of the reinvented per-page `<pre>` chrome.

type DomainRow = { slug: string; name: string };
type ServerRow = { id: string; name: string; transport: string };
type TokenRow = { id: string; name: string };

type Tier = 'org' | 'domain' | 'server';

type Props = {
  domains: DomainRow[];
  servers: ServerRow[];
  tokens: TokenRow[];
};

// useSyncExternalStore needs a subscribe fn even for static browser values.
// origin doesn't change after mount, so the subscriber is a no-op.
const subscribeNoop = () => () => {};

const slugify = (input: string): string => {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'semantic-gps';
};

export const ConnectPanel = ({ domains, servers, tokens }: Props) => {
  const [tier, setTier] = useState<Tier>('org');
  // Domain tab is disabled ("Soon"), so the slug stays at its default —
  // no setter needed until the tab unlocks.
  const domainSlug = domains[0]?.slug ?? '';
  const [serverId, setServerId] = useState<string>(servers[0]?.id ?? '');
  const [pasteToken, setPasteToken] = useState<string>('');
  const [testState, setTestState] = useState<
    | { kind: 'idle' }
    | { kind: 'pending' }
    | { kind: 'ok'; toolCount: number }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const origin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  );

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
    <Card>
      <CardContent className="flex flex-col gap-6">
        <Section step="1" label="Scope">
          <ScopeRow
            tier={tier}
            onTierChange={setTier}
            servers={servers}
            serverId={serverId}
            onServerChange={setServerId}
          />
        </Section>

        <SectionDivider />

        <Section step="2" label="Endpoint">
          <EndpointRow endpoint={endpoint} />
        </Section>

        <SectionDivider />

        <Section step="3" label="Test connection">
          <TestRow
            tokens={tokens}
            pasteToken={pasteToken}
            setPasteToken={setPasteToken}
            onTest={onTest}
            canTest={tierReady && pasteToken.length > 0 && testState.kind !== 'pending'}
            testState={testState}
          />
        </Section>

        <SectionDivider />

        <Section step="4" label="Client snippet">
          <SnippetTabs snippetInput={snippetInput} />
        </Section>
      </CardContent>
    </Card>
  );
};

const Section = ({
  step,
  label,
  children,
}: {
  step: string;
  label: string;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <span className="inline-flex size-5 items-center justify-center rounded-full border bg-muted/50 font-mono text-[10px] tabular-nums">
        {step}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </div>
    {children}
  </section>
);

const SectionDivider = () => <div className="h-px w-full bg-border" aria-hidden="true" />;

type ScopeRowProps = {
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  servers: ServerRow[];
  serverId: string;
  onServerChange: (id: string) => void;
};

const ScopeRow = ({ tier, onTierChange, servers, serverId, onServerChange }: ScopeRowProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
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
  <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
    <span className="truncate font-mono text-sm text-foreground/90">{endpoint}</span>
    <CopyButton value={endpoint} label="Copy URL" />
  </div>
);

type SnippetTabsProps = { snippetInput: SnippetInput };

const SnippetTabs = ({ snippetInput }: SnippetTabsProps) => (
  <Tabs defaultValue="curl" className="gap-3">
    <TabsList>
      <TabsTrigger value="curl">curl</TabsTrigger>
      <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
      <TabsTrigger value="inspector">MCP Inspector</TabsTrigger>
      <TabsTrigger value="sdk">Anthropic SDK</TabsTrigger>
    </TabsList>
    <TabsContent value="curl" className="mt-0">
      <CodeBlock code={curlSnippet(snippetInput)} ariaLabel="curl snippet" />
    </TabsContent>
    <TabsContent value="claude" className="mt-0">
      <CodeBlock code={claudeDesktopSnippet(snippetInput)} ariaLabel="Claude Desktop snippet" />
    </TabsContent>
    <TabsContent value="inspector" className="mt-0">
      <CodeBlock code={inspectorSnippet(snippetInput)} ariaLabel="MCP Inspector snippet" />
    </TabsContent>
    <TabsContent value="sdk" className="mt-0">
      <CodeBlock code={anthropicSdkSnippet(snippetInput)} ariaLabel="Anthropic SDK snippet" />
    </TabsContent>
  </Tabs>
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
  <div className="flex flex-col gap-3">
    <p className="text-xs text-muted-foreground">
      {tokens.length === 0
        ? 'Mint a gateway token to authenticate any client. Or paste an existing plaintext value below to test live — it stays in your browser and never re-renders into snippets unless you choose.'
        : 'Paste a gateway token plaintext value to test live against this scope. The value stays in your browser and never re-renders into snippets unless you choose.'}
    </p>
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
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-label="Gateway token"
        // Tell every major password manager this is NOT a credential field —
        // the token is session-only paste-to-test, never stored. Without
        // these, Dashlane/1Password/LastPass offer to save it as a password.
        data-form-type="other"
        data-1p-ignore
        data-lpignore="true"
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
