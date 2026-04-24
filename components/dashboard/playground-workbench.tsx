'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  PlayIcon,
  ServerIcon,
  SparklesIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { SCENARIOS } from './playground-scenarios';
import {
  PANES,
  applyEvent,
  emptyPane,
  toStreamEvents,
} from './playground-event-reducer';
import type { PaneState } from './playground-event-reducer';
import { PaneView } from './playground-pane-view';

// Sprint 17 WP-17.3: pure decision function driving both the Execute button's
// disabled state and the visible "Register a server first" CTA. Exported so
// `__tests__/playground-no-mcp-guard.vitest.ts` can cover it without a
// component-render stack (vitest runs in node, repo has no jsdom / RTL).
//
// - `canExecute` — all three must be true: org has ≥1 registered MCP server,
//   no pane is mid-run, and the prompt has non-whitespace content.
// - `showMissingServersNotice` — tracks server presence only; stays visible
//   while busy so the user sees the "register a server" CTA regardless of
//   where in the run lifecycle they clicked.
export const computePlaygroundGate = (input: {
  hasServers: boolean;
  busy: boolean;
  promptText: string;
}): { canExecute: boolean; showMissingServersNotice: boolean } => ({
  canExecute:
    input.hasServers && !input.busy && input.promptText.trim().length > 0,
  showMissingServersNotice: !input.hasServers,
});

// Sprint 8 WP-J.1: client workbench. A single prompt drives two runs in
// parallel — raw (real SF/Slack/GH upstreams with no control plane around
// them) and gateway (our MCP gateway routed through Anthropic's beta
// `mcp_servers` connector, with policies + relationships + rollback + audit).
// Events stream as NDJSON from /api/playground/run and render per-pane.

export const PlaygroundWorkbench = ({
  tokenName,
  hasServers = true,
}: {
  tokenName: string;
  hasServers?: boolean;
}) => {
  const [prompt, setPrompt] = useState<string>(SCENARIOS[0].prompt);
  const [raw, setRaw] = useState<PaneState>(emptyPane());
  const [gateway, setGateway] = useState<PaneState>(emptyPane());

  const runPane = useCallback(
    async (mode: 'raw' | 'gateway', promptText: string): Promise<void> => {
      const setState = mode === 'raw' ? setRaw : setGateway;
      setState({ ...emptyPane(), running: true });

      try {
        const res = await fetch('/api/playground/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, mode }),
        });
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
    [],
  );

  const runBoth = useCallback(() => {
    const promptText = prompt.trim();
    if (promptText.length === 0) {
      toast.error('Prompt is empty');
      return;
    }
    void runPane('raw', promptText);
    void runPane('gateway', promptText);
  }, [prompt, runPane]);

  const busy = raw.running || gateway.running;
  const gate = computePlaygroundGate({ hasServers, busy, promptText: prompt });

  return (
    <div className="flex flex-col gap-4">
      {gate.showMissingServersNotice ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ServerIcon className="size-4" />
              Register an MCP server first
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              The Playground routes calls through your org&apos;s registered MCP servers. You
              don&apos;t have any yet, so the governed pane would return an empty manifest and
              the model would respond text-only.
            </p>
            <Button asChild>
              <Link href="/dashboard/servers">Register a server</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Prompt</CardTitle>
            <Badge variant="outline" className="text-xs">
              gateway token: <span className="ml-1 font-medium">{tokenName}</span>
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                onClick={() => setPrompt(s.prompt)}
                title={s.hint}
                disabled={busy}
              >
                <SparklesIcon className="size-3.5" />
                {s.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="Describe a multi-step agent task…"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              One click, two agents. Left pane calls the same real upstreams directly with
              zero governance. Right pane routes through{' '}
              <code className="rounded bg-muted px-1">/api/mcp</code> with policies,
              relationship hints, and rollback wired in.
            </p>
            <Button onClick={runBoth} disabled={!gate.canExecute}>
              <PlayIcon className="size-4" />
              {busy ? 'Running…' : 'Run on both'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PANES.map((pane) => {
          const state = pane.key === 'raw' ? raw : gateway;
          return <PaneView key={pane.key} pane={pane} state={state} />;
        })}
      </div>
    </div>
  );
};
