'use client';

import Link from 'next/link';
import { ChevronRightIcon, ListFilterIcon, PlayIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Pane, PaneState } from './playground-event-reducer';
import { PlaygroundMarkdown } from './playground-markdown';

type Props = {
  pane: Pane;
  state: PaneState;
  canRun: boolean;
  onRun: () => void;
};

// Per-pane theme. Raw = warning red (no protection); Gateway = emerald
// (protected). Strong border + tinted bg + colored caption replace the
// generic "pill" label so the governance contrast reads at a glance,
// before the user reads a word.
const PANE_THEME = {
  raw: {
    cardClass: 'border-red-500/40',
    iconClass: 'text-red-300',
    captionClass: 'text-red-300/90',
    captionLabel: 'UNGOVERNED · NO POLICIES · NO AUDIT',
  },
  gateway: {
    cardClass: 'border-emerald-500/40',
    iconClass: 'text-emerald-300',
    captionClass: 'text-emerald-300/90',
    captionLabel: 'GOVERNED · POLICIES · AUDIT · ROLLBACK',
  },
} as const;

// Section labels — terminal-stream feel. Tiny mono uppercase markers with a
// `▸` prefix so each block reads like a log section rather than a card.
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
    ▸ {children}
  </span>
);

export const PaneView = ({ pane, state, canRun, onRun }: Props) => {
  const Icon = pane.icon;
  const theme = PANE_THEME[pane.key];
  const hasRun = state.stats !== null || state.toolCalls.length > 0 || Boolean(state.text);
  const showAwaiting = !state.running && !hasRun && !state.error;

  return (
    <Card className={cn('flex flex-col gap-0 overflow-hidden p-0', theme.cardClass)}>
      {/* Pane header: title + run on row 1, governance caption alone on row 2.
          Two-row stack keeps the title from wrapping and the caption from
          truncating in narrow viewports. */}
      <div className="flex flex-col gap-1 border-b border-border/50 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={cn('size-4 shrink-0', theme.iconClass)} />
            <span className="truncate text-sm font-semibold">{pane.title}</span>
          </div>
          <Button
            size="sm"
            onClick={onRun}
            disabled={!canRun || state.running}
            className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
          >
            <PlayIcon className="size-3.5" />
            {state.running ? 'Running…' : 'Run'}
          </Button>
        </div>
        <span className={cn('font-mono text-[10px] tracking-[0.12em]', theme.captionClass)}>
          {theme.captionLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 py-3">
        {showAwaiting ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            ready · click run to fire
          </div>
        ) : null}

        {state.running && state.toolCalls.length === 0 && !state.text && !state.thinking ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-blue-400" />
            streaming…
          </div>
        ) : null}

        {state.toolCalls.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>tool calls · {state.toolCalls.length}</SectionLabel>
            <ul className="flex flex-col">
              {state.toolCalls.map((call) => {
                const result = state.toolResults.get(call.id);
                const status = result?.is_error ? 'error' : result ? 'ok' : 'pending';
                return (
                  <li
                    key={call.id}
                    className="border-b border-border/30 py-1 last:border-b-0 last:pb-0 first:pt-0"
                  >
                    <div className="flex items-baseline gap-2 font-mono text-[11px]">
                      <span
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 self-start rounded-full',
                          status === 'error'
                            ? 'bg-red-400'
                            : status === 'ok'
                              ? 'bg-emerald-400'
                              : 'animate-pulse bg-amber-400',
                        )}
                      />
                      <span className="font-semibold text-foreground">{call.name}</span>
                      <span className="truncate text-muted-foreground/80">{call.args_preview}</span>
                      <span
                        className={cn(
                          'ml-auto shrink-0 tabular-nums',
                          status === 'error'
                            ? 'text-red-300/90'
                            : status === 'ok'
                              ? 'text-muted-foreground'
                              : 'text-amber-300/80',
                        )}
                      >
                        {result
                          ? typeof result.ms === 'number'
                            ? `${result.ms} ms`
                            : status === 'error'
                              ? 'blocked'
                              : 'done'
                          : '…'}
                      </span>
                    </div>
                    {result ? (
                      <p className="mt-0.5 line-clamp-2 pl-3.5 font-mono text-[10px] text-muted-foreground/70">
                        {result.summary}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {pane.key === 'gateway' && state.policyEvents.length > 0 ? (
          <div className="flex flex-col gap-1">
            <SectionLabel>policy events · {state.policyEvents.length}</SectionLabel>
            {state.policyEvents.map((evt, i) => (
              <p key={i} className="font-mono text-[11px] text-amber-200/90">
                ⚠ {evt.detail}
              </p>
            ))}
          </div>
        ) : null}

        {state.thinking ? (
          <details className="group" open={state.running && state.toolCalls.length === 0}>
            <summary className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-violet-300/90 select-none">
              <ChevronRightIcon className="size-3 transition-transform group-open:rotate-90" />
              reasoning · {state.thinking.length.toLocaleString()} chars
            </summary>
            <pre className="scrollbar-dark mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-violet-500/20 bg-violet-500/[0.03] p-2 font-mono text-[11px] leading-relaxed text-violet-100/80">
              {state.thinking}
            </pre>
          </details>
        ) : null}

        {state.text ? (
          <div className="flex flex-col gap-1">
            <SectionLabel>response</SectionLabel>
            <PlaygroundMarkdown text={state.text} />
          </div>
        ) : null}

        {state.error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 font-mono text-[11px] text-red-200">
            {state.error}
          </div>
        ) : null}
      </div>

      {hasRun ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 bg-background/40 px-3 py-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>{state.stats?.tool_calls ?? state.toolCalls.length} call(s)</span>
          <span className="opacity-50">·</span>
          <span>{state.stats?.ms ? `${state.stats.ms} ms` : state.running ? '…' : '—'}</span>
          {pane.key === 'gateway' ? (
            <>
              <span className="opacity-50">·</span>
              <span>{state.stats?.policy_events ?? state.policyEvents.length} policy</span>
            </>
          ) : null}
          {state.stats?.thinking_chars ? (
            <>
              <span className="opacity-50">·</span>
              <span>{state.stats.thinking_chars.toLocaleString()} thinking</span>
            </>
          ) : null}
          {state.stats?.trace_id ? (
            <Link
              href={`/dashboard/audit?trace_id=${encodeURIComponent(state.stats.trace_id)}`}
              className="ml-auto inline-flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-foreground"
            >
              <ListFilterIcon className="size-3.5" />
              View audit trail
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};
