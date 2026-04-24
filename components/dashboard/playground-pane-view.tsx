'use client';

import { SparklesIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Pane, PaneState } from './playground-event-reducer';

export const PaneView = ({ pane, state }: { pane: Pane; state: PaneState }) => {
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

        {state.thinking ? (
          <details className="group rounded-md border border-violet-500/30 bg-violet-500/5 px-2.5 py-1.5 text-xs">
            <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-violet-300 select-none">
              <SparklesIcon className="size-3.5" />
              Show reasoning
              <span className="ml-auto text-[10px] font-normal text-violet-300/60">
                {state.thinking.length.toLocaleString()} chars
              </span>
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-violet-100/80">
              {state.thinking}
            </pre>
          </details>
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
