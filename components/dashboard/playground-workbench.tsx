'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ServerIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSidebar } from '@/components/ui/sidebar';
import { SCENARIOS } from './playground-scenarios';
import {
  PANES,
  applyEvent,
  emptyPane,
  toStreamEvents,
} from './playground-event-reducer';
import type { PaneState } from './playground-event-reducer';
import { PaneView } from './playground-pane-view';

// Playground workbench. One prompt drives two panes (Raw vs Gateway), each
// with its own Run button, never parallel. Dense terminal-style controls
// in a single block: scope toggles + server picker + example shortcuts +
// prompt textarea, no internal cards or dividers competing for visual
// weight. Token is always the auto-managed system token; the playground
// is plumbing, not a token-management surface.

type ServerOption = { id: string; name: string };
type Scope = 'org' | 'server';

type Props = {
  servers: ServerOption[];
};

type RateLimitInfo = {
  limit: number;
  used: number;
  retryAfterSeconds: number;
};

const formatRetry = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.ceil(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.ceil(m / 60);
  return `${h} hour${h === 1 ? '' : 's'}`;
};

export const PlaygroundWorkbench = ({ servers }: Props) => {
  const [prompt, setPrompt] = useState<string>(SCENARIOS[0].prompt);
  const [raw, setRaw] = useState<PaneState>(emptyPane());
  const [gateway, setGateway] = useState<PaneState>(emptyPane());
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  const [scope, setScope] = useState<Scope>('org');
  const [serverId, setServerId] = useState<string | undefined>(undefined);

  // Collapse the sidebar on the first Run so the panes get the full width
  // for tool calls, reasoning, and streamed markdown, every pixel counts.
  const { setOpen } = useSidebar();

  const hasServers = servers.length > 0;
  const busy = raw.running || gateway.running;
  const promptText = prompt.trim();

  const scopeReady = scope === 'org' || (scope === 'server' && Boolean(serverId));
  const canRun = hasServers && promptText.length > 0 && scopeReady;

  const runPane = useCallback(
    async (mode: 'raw' | 'gateway'): Promise<void> => {
      if (!canRun) return;
      setOpen(false);
      const setState = mode === 'raw' ? setRaw : setGateway;
      setState({ ...emptyPane(), running: true });

      const body: Record<string, unknown> = {
        prompt: promptText,
        mode,
        scope,
      };
      if (scope === 'server' && serverId) body.serverId = serverId;

      try {
        const res = await fetch('/api/playground/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 429) {
          const payload = (await res.json().catch(() => null)) as {
            limit?: number;
            used?: number;
            retryAfterSeconds?: number;
          } | null;
          const retry = payload?.retryAfterSeconds ?? 3600;
          setRateLimit({
            limit: payload?.limit ?? 6,
            used: payload?.used ?? 6,
            retryAfterSeconds: retry,
          });
          setState((prev) => ({
            ...prev,
            running: false,
            error: `Hourly limit reached. Try again in ${formatRetry(retry)}.`,
          }));
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          setState((prev) => ({
            ...prev,
            running: false,
            error: `HTTP ${res.status} ${text.slice(0, 160)}`,
          }));
          return;
        }
        await toStreamEvents(res, (event) => {
          setState((prev) => applyEvent(prev, event));
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'run failed';
        setState((prev) => ({ ...prev, running: false, error: message }));
      }
    },
    [canRun, promptText, scope, serverId, setOpen],
  );

  const handleRun = useCallback(
    (mode: 'raw' | 'gateway') => {
      if (!hasServers) {
        toast.error('Register an MCP server first');
        return;
      }
      if (promptText.length === 0) {
        toast.error('Prompt is empty');
        return;
      }
      if (!scopeReady) {
        toast.error('Pick a server for server-scoped runs');
        return;
      }
      void runPane(mode);
    },
    [hasServers, promptText, scopeReady, runPane],
  );

  return (
    <div className="flex flex-col gap-3">
      {!hasServers ? <NoServersNotice /> : null}

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        {/* Single dense control strip, scope · server · examples, replaces
            the three stacked rows the old design used. Mono labels keep the
            weight light; ToggleGroup + Select carry the actual interaction. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/50 px-3 py-2">
          <ControlGroup label="scope">
            <ToggleGroup
              type="single"
              variant="outline"
              value={scope}
              onValueChange={(v) => {
                if (v === 'org' || v === 'server') {
                  setScope(v);
                  if (v === 'org') setServerId(undefined);
                }
              }}
              disabled={busy}
            >
              <ToggleGroupItem value="org" className="h-7 px-2.5 text-[11px]">
                org
              </ToggleGroupItem>
              <ToggleGroupItem value="domain" className="h-7 px-2.5 text-[11px]" disabled>
                domain
                <span className="ml-1 text-[9px] text-muted-foreground">soon</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="server" className="h-7 px-2.5 text-[11px]">
                server
              </ToggleGroupItem>
            </ToggleGroup>
          </ControlGroup>

          <ControlGroup label="server">
            <Select
              value={serverId ?? ''}
              onValueChange={(v) => setServerId(v || undefined)}
              disabled={busy || scope !== 'server' || servers.length === 0}
            >
              <SelectTrigger className="h-7 min-w-[160px] text-[11px]">
                <SelectValue
                  placeholder={
                    scope !== 'server'
                      ? 'org-wide manifest'
                      : servers.length === 0
                        ? 'no servers'
                        : 'pick a server'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[11px]">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ControlGroup>

          <ControlGroup label="examples">
            <div className="flex flex-wrap items-center gap-1.5">
              {SCENARIOS.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt(s.prompt)}
                  title={s.hint}
                  disabled={busy}
                  className="h-7 gap-1.5 px-2.5 text-[11px]"
                >
                  <SparklesIcon className="size-3" />
                  {s.label}
                </Button>
              ))}
            </div>
          </ControlGroup>
        </div>

        <div className="px-3 py-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
            rows={3}
            placeholder="Describe a multi-step agent task, what should the model attempt against your MCPs?"
            className="resize-y text-sm"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {PANES.map((pane) => {
          const state = pane.key === 'raw' ? raw : gateway;
          return (
            <PaneView
              key={pane.key}
              pane={pane}
              state={state}
              canRun={canRun}
              onRun={() => handleRun(pane.key)}
            />
          );
        })}
      </div>

      <Dialog open={rateLimit !== null} onOpenChange={(open) => !open && setRateLimit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Playground hourly limit reached</DialogTitle>
            <DialogDescription>
              {rateLimit
                ? `You've used ${rateLimit.used} of ${rateLimit.limit} runs in the last hour. Resets in ${formatRetry(rateLimit.retryAfterSeconds)}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              The Playground runs against the platform&apos;s Anthropic key, so we cap inbound runs to keep
              the wallet honest. The gateway itself is not rate-limited, your agents can keep calling it.
            </p>
            <p>
              Grab your gateway URL from the Connect page and continue testing through Claude Code, Codex,
              MCP Inspector, or any other agentic tool. BYOK Playground (your own provider key, multi-model)
              is on the way.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRateLimit(null)}>
              Close
            </Button>
            <Button asChild>
              <Link href="/dashboard/connect">Open Connect page</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ControlGroup = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`flex items-center gap-2 ${className ?? ''}`}>
    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      ▸ {label}
    </span>
    {children}
  </div>
);

const NoServersNotice = () => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/[0.05] px-3 py-2 text-sm">
    <div className="flex items-center gap-2">
      <ServerIcon className="size-4 shrink-0 text-amber-300" />
      <span className="text-amber-200">
        No MCP servers registered, the gateway pane will return an empty manifest.
      </span>
    </div>
    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
      <Link href="/dashboard/servers">Register a server</Link>
    </Button>
  </div>
);

// Pure decision function exported for `__tests__/playground-no-mcp-guard.vitest.ts`.
// Stays a 1:1 contract with the test suite, the workbench drives Run from
// per-pane state directly, but this gate is the canonical predicate for
// "can this org run anything?".
export const computePlaygroundGate = (input: {
  hasServers: boolean;
  busy: boolean;
  promptText: string;
}): { canExecute: boolean; showMissingServersNotice: boolean } => ({
  canExecute:
    input.hasServers && !input.busy && input.promptText.trim().length > 0,
  showMissingServersNotice: !input.hasServers,
});
