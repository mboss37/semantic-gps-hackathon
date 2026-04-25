'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowRightIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ToolSummary = {
  name: string;
  description: string | null;
};

export type ServerHealth = 'ok' | 'degraded' | 'down' | 'unknown';

type Props = {
  id: string;
  name: string;
  transport: string;
  originUrl: string | null;
  createdAt: string;
  tools: ToolSummary[];
  calls24h: number;
  errors24h: number;
  health: ServerHealth;
};

const TOOL_LIMIT = 5;

const HEALTH_DOT_CLASS: Record<ServerHealth, string> = {
  ok: 'bg-emerald-500 ring-emerald-500/40',
  degraded: 'bg-amber-500 ring-amber-500/40',
  down: 'bg-red-500 ring-red-500/40',
  unknown: 'bg-zinc-500 ring-zinc-500/40',
};

const HEALTH_LABEL: Record<ServerHealth, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'No traffic yet',
};

const formatRegistered = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

export const ServerCard = ({
  id,
  name,
  transport,
  originUrl,
  createdAt,
  tools,
  calls24h,
  errors24h,
  health,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const onDelete = async (e: React.MouseEvent) => {
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

  const onRediscover = async (e: React.MouseEvent) => {
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

  const onCardClick = () => {
    router.push(`/dashboard/servers/${id}`);
  };

  const visibleTools = expanded ? tools : tools.slice(0, TOOL_LIMIT);
  const hiddenCount = tools.length - visibleTools.length;

  return (
    <Card
      onClick={onCardClick}
      className="cursor-pointer transition-colors hover:bg-accent/30"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`size-2.5 shrink-0 rounded-full ring-4 ${HEALTH_DOT_CLASS[health]}`}
                  aria-label={HEALTH_LABEL[health]}
                />
              </TooltipTrigger>
              <TooltipContent side="top">{HEALTH_LABEL[health]}</TooltipContent>
            </Tooltip>
            <div className="min-w-0">
              <p className="truncate font-medium">{name}</p>
              {originUrl ? (
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {originUrl}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2" onClick={stop}>
            <Badge variant="outline">{transport}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">Server actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onRediscover}>
                  <RefreshCwIcon className="size-3.5" />
                  Rediscover tools
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onDelete}
                >
                  <Trash2Icon className="size-3.5" />
                  Delete server
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{tools.length}</span>{' '}
            {tools.length === 1 ? 'tool' : 'tools'}
          </span>
          <span aria-hidden>·</span>
          <span>
            <span className="font-medium text-foreground">{calls24h}</span>{' '}
            {calls24h === 1 ? 'call' : 'calls'} 24h
          </span>
          <span aria-hidden>·</span>
          <span className={errors24h > 0 ? 'text-amber-400' : ''}>
            <span className={`font-medium ${errors24h > 0 ? 'text-amber-300' : 'text-foreground'}`}>
              {errors24h}
            </span>{' '}
            {errors24h === 1 ? 'error' : 'errors'}
          </span>
          <span aria-hidden>·</span>
          <span>registered {formatRegistered(createdAt)}</span>
        </div>

        {tools.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tools discovered — origin may be unreachable.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5" onClick={stop}>
            {visibleTools.map((t) => (
              <Tooltip key={t.name}>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="font-mono text-[11px] font-normal">
                    {t.name}
                  </Badge>
                </TooltipTrigger>
                {t.description ? (
                  <TooltipContent side="bottom" className="max-w-xs">
                    {t.description}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            ))}
            {hiddenCount > 0 ? (
              <Badge
                variant="outline"
                className="cursor-pointer text-[11px] font-normal"
                onClick={() => setExpanded(true)}
              >
                +{hiddenCount} more
              </Badge>
            ) : null}
            {expanded && tools.length > TOOL_LIMIT ? (
              <Badge
                variant="outline"
                className="cursor-pointer text-[11px] font-normal"
                onClick={() => setExpanded(false)}
              >
                Collapse
              </Badge>
            ) : null}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-end">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          View details
          <ArrowRightIcon className="size-3.5" />
        </span>
      </CardFooter>
    </Card>
  );
};
