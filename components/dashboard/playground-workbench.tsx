'use client';

import { useCallback, useState } from 'react';
import { PlayIcon, SparklesIcon, ShieldCheckIcon, ZapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

// Sprint 8 WP-J.1: client workbench. A single prompt drives two runs in
// parallel — raw (real SF/Slack/GH upstreams with no control plane around
// them) and gateway (our MCP gateway routed through Anthropic's beta
// `mcp_servers` connector, with policies + relationships + rollback + audit).
// Events stream as NDJSON from /api/playground/run and render per-pane.

type ToolCallEvent = {
  type: 'tool_call';
  id: string;
  name: string;
  args_preview: string;
};

type ToolResultEvent = {
  type: 'tool_result';
  id: string;
  summary: string;
  is_error?: boolean;
};

type TextEvent = { type: 'text'; content: string };

type PolicyEvent = { type: 'policy_event'; detail: string };

type ErrorEvent = { type: 'error'; message: string };

type DoneEvent = {
  type: 'done';
  stats: {
    tool_calls: number;
    ms: number;
    policy_events?: number;
  };
};

type StreamEvent =
  | ToolCallEvent
  | ToolResultEvent
  | TextEvent
  | PolicyEvent
  | ErrorEvent
  | DoneEvent;

type PaneState = {
  running: boolean;
  toolCalls: ToolCallEvent[];
  toolResults: Map<string, ToolResultEvent>;
  policyEvents: PolicyEvent[];
  text: string;
  error: string | null;
  stats: DoneEvent['stats'] | null;
};

const emptyPane = (): PaneState => ({
  running: false,
  toolCalls: [],
  toolResults: new Map(),
  policyEvents: [],
  text: '',
  error: null,
  stats: null,
});

type Scenario = {
  id: string;
  label: string;
  prompt: string;
  hint: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'customer-escalation',
    label: 'Customer escalation',
    prompt:
      "A customer at Edge Communications (contact email rose@edgecomm.com) reported a payment crash on checkout. Find the Salesforce account, file an engineering ticket to mboss37/semantic-gps-sandbox titled 'Payment crash on checkout - Edge Communications', post a summary to Slack channel #sozial, and create a Salesforce task with subject 'Follow-up' on the account.",
    hint: 'Cross-MCP workflow — SF → GH → Slack → SF task. The sozial channel exists; the contact may not (graceful fail).',
  },
  {
    id: 'pii-leak',
    label: 'PII leak test',
    prompt:
      "Look up the Salesforce contact with email rose@edgecomm.com and post her full contact details (name, email, phone) to Slack channel #sozial so the team can reach her.",
    hint: 'Hero beat — flip PII policy shadow→enforce, re-run, watch email get redacted on the gateway side only.',
  },
  {
    id: 'simple-lookup',
    label: 'Simple lookup',
    prompt: 'Find the Salesforce account for Edge Communications.',
    hint: 'Single-hop warmup — both panes should behave similarly.',
  },
];

const toStreamEvents = async (
  res: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<void> => {
  if (!res.body) throw new Error('no response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as StreamEvent;
        onEvent(parsed);
      } catch {
        // Skip malformed line — keep the stream alive on downstream bugs.
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as StreamEvent);
    } catch {
      // swallow
    }
  }
};

const applyEvent = (prev: PaneState, event: StreamEvent): PaneState => {
  if (event.type === 'tool_call') {
    return { ...prev, toolCalls: [...prev.toolCalls, event] };
  }
  if (event.type === 'tool_result') {
    const next = new Map(prev.toolResults);
    next.set(event.id, event);
    return { ...prev, toolResults: next };
  }
  if (event.type === 'policy_event') {
    return { ...prev, policyEvents: [...prev.policyEvents, event] };
  }
  if (event.type === 'text') {
    return { ...prev, text: prev.text + event.content };
  }
  if (event.type === 'error') {
    return { ...prev, error: event.message };
  }
  if (event.type === 'done') {
    return { ...prev, running: false, stats: event.stats };
  }
  return prev;
};

type Pane = {
  key: 'raw' | 'gateway';
  title: string;
  badge: string;
  badgeTone: 'muted' | 'governed';
  icon: typeof ZapIcon;
};

const PANES: Pane[] = [
  {
    key: 'raw',
    title: 'Raw MCP',
    badge: 'Direct / no governance',
    badgeTone: 'muted',
    icon: ZapIcon,
  },
  {
    key: 'gateway',
    title: 'Semantic GPS',
    badge: 'Policy-enforced',
    badgeTone: 'governed',
    icon: ShieldCheckIcon,
  },
];

export const PlaygroundWorkbench = ({ tokenName }: { tokenName: string }) => {
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

  return (
    <div className="flex flex-col gap-4">
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
            <Button onClick={runBoth} disabled={busy}>
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

const PaneView = ({ pane, state }: { pane: Pane; state: PaneState }) => {
  const Icon = pane.icon;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4" />
            <CardTitle className="text-base">{pane.title}</CardTitle>
          </div>
          <Badge
            variant={pane.badgeTone === 'governed' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {pane.badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {state.toolCalls.length === 0 && !state.text && !state.error && !state.running ? (
          <p className="text-xs text-muted-foreground">
            Awaiting run. Results appear here once the agent starts.
          </p>
        ) : null}

        {state.running && state.toolCalls.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-blue-400" />
            Streaming…
          </p>
        ) : null}

        {state.toolCalls.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {state.toolCalls.map((call) => {
              const result = state.toolResults.get(call.id);
              const status = result?.is_error ? 'error' : result ? 'ok' : 'pending';
              return (
                <div
                  key={call.id}
                  className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        status === 'error'
                          ? 'size-2 shrink-0 rounded-full bg-red-400'
                          : status === 'ok'
                            ? 'size-2 shrink-0 rounded-full bg-green-400'
                            : 'size-2 shrink-0 shrink-0 animate-pulse rounded-full bg-yellow-400'
                      }
                    />
                    <code className="font-mono text-xs font-semibold">{call.name}</code>
                    <span className="truncate text-muted-foreground">
                      {call.args_preview}
                    </span>
                  </div>
                  {result ? (
                    <p className="mt-1 line-clamp-2 pl-4 text-[11px] text-muted-foreground">
                      {result.summary}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {pane.key === 'gateway' && state.policyEvents.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs">
            <span className="font-medium text-amber-300">Policy events</span>
            {state.policyEvents.map((evt, i) => (
              <span key={i} className="text-amber-200/90">
                {evt.detail}
              </span>
            ))}
          </div>
        ) : null}

        {state.text ? (
          <div className="whitespace-pre-wrap rounded-md border bg-background/50 px-3 py-2 text-sm leading-relaxed">
            {state.text}
          </div>
        ) : null}

        {state.error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {state.error}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span>{state.stats?.tool_calls ?? state.toolCalls.length} tool calls</span>
          <span className="opacity-50">·</span>
          <span>{state.stats?.ms ? `${state.stats.ms} ms` : state.running ? '…' : '—'}</span>
          {pane.key === 'gateway' ? (
            <>
              <span className="opacity-50">·</span>
              <span>
                {state.stats?.policy_events ?? state.policyEvents.length} policy events
              </span>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
