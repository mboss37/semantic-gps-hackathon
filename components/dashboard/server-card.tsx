'use client';

import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XCircleIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { HealthStatus } from '@/lib/servers/health';

export type ToolSummary = {
  name: string;
  description: string | null;
};

type Props = {
  id: string;
  name: string;
  transport: string;
  originUrl: string | null;
  tools: ToolSummary[];
  calls24h: number;
  errors24h: number;
  health: HealthStatus;
  healthLatencyMs: number | null;
};

const TOOL_LIMIT = 6;

const HEALTH_LABEL: Record<HealthStatus, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unprobed',
};

const HEALTH_BADGE_CLASS: Record<HealthStatus, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  down: 'border-red-500/30 bg-red-500/10 text-red-300',
  unknown: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
};

const HealthIcon = ({ status }: { status: HealthStatus }) => {
  if (status === 'ok') return <CheckCircle2Icon className="size-3.5" />;
  if (status === 'degraded') return <TriangleAlertIcon className="size-3.5" />;
  if (status === 'down') return <XCircleIcon className="size-3.5" />;
  return <CircleHelpIcon className="size-3.5" />;
};

export const ServerCard = ({
  id,
  name,
  transport,
  originUrl,
  tools,
  calls24h,
  errors24h,
  health,
  healthLatencyMs,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const stop = (e: MouseEvent) => e.stopPropagation();

  const onDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete server "${name}" and all its tools?`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Server deleted');
      router.refresh();
    } catch {
      toast.error('Delete failed');
    } finally {
      setPending(false);
    }
  };

  const onRediscover = async (e: MouseEvent) => {
    e.stopPropagation();
    setPending(true);
    try {
      const res = await fetch(`/api/servers/${id}/rediscover`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Rediscovery started');
      router.refresh();
    } catch {
      toast.error('Rediscover failed');
    } finally {
      setPending(false);
    }
  };

  const visibleTools = expanded ? tools : tools.slice(0, TOOL_LIMIT);
  const hiddenCount = tools.length - visibleTools.length;
  const hasLatency = healthLatencyMs !== null && health !== 'unknown';

  return (
    <Card
      onClick={() => router.push(`/dashboard/servers/${id}`)}
      className="group relative cursor-pointer transition-colors hover:bg-accent/30"
    >
      <CardContent className="flex flex-col gap-4">
        {/* Identity row — name on the left, health pill + actions on the right */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-[15px] font-medium tracking-tight">{name}</h3>
          <div className="flex shrink-0 items-center gap-2" onClick={stop}>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${HEALTH_BADGE_CLASS[health]}`}
              title={HEALTH_LABEL[health]}
            >
              <HealthIcon status={health} />
              {HEALTH_LABEL[health]}
              {hasLatency ? (
                <span className="font-mono text-[10px] opacity-80">{healthLatencyMs}ms</span>
              ) : null}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-50 transition-opacity hover:opacity-100 group-hover:opacity-100"
                  disabled={pending}
                  aria-label="Server actions"
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onRediscover}>
                  <RefreshCwIcon className="size-3.5" />
                  Rediscover tools
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2Icon className="size-3.5" />
                  Delete server
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Origin URL — confirms which upstream this is at a glance */}
        {originUrl ? (
          <p className="-mt-2 truncate font-mono text-[11px] text-muted-foreground">
            {originUrl}
          </p>
        ) : null}

        {/* Tools section — labeled, then chips */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">Tools</h4>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
              {tools.length}
            </span>
          </div>
          {tools.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground/80">
              No tools discovered — rediscover or check origin
            </p>
          ) : (
            <div className="flex flex-wrap gap-1" onClick={stop}>
              {visibleTools.map((t) => (
                <Tooltip key={t.name}>
                  <TooltipTrigger asChild>
                    <code className="rounded-sm bg-muted/60 px-1.5 py-[3px] font-mono text-[11px] leading-none text-foreground/85 transition-colors hover:bg-muted">
                      {t.name}
                    </code>
                  </TooltipTrigger>
                  {t.description ? (
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {t.description}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              ))}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  className="rounded-sm px-1.5 py-[3px] font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                  }}
                >
                  +{hiddenCount}
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Traffic strip — actionable activity signal, transport demoted to tail */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="text-foreground">{calls24h}</span> calls 24h
          </span>
          <span className="opacity-40" aria-hidden>·</span>
          <span className={errors24h > 0 ? 'text-amber-300' : ''}>
            <span className={`${errors24h > 0 ? 'font-medium' : 'text-foreground'}`}>
              {errors24h}
            </span>{' '}
            err
          </span>
          <span className="opacity-40" aria-hidden>·</span>
          <span>{transport}</span>
        </div>
      </CardContent>

      <ArrowUpRightIcon
        className="pointer-events-none absolute right-4 bottom-4 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Card>
  );
};
