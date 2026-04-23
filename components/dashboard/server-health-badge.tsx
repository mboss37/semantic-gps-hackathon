'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2Icon,
  Loader2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Sprint 14 WP-14.2: live origin health badge backed by
// /api/servers/[id]/health. Compact inline layout — meant to live inside a
// CardContent. Icon + status word + latency + last-checked + refresh.

type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

type HealthResponse = {
  status: HealthStatus;
  statusCode?: number;
  latencyMs?: number;
  reason?: string;
  checkedAt: string;
};

type Props = { serverId: string };

const STATUS_TEXT: Record<HealthStatus, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

const StatusIcon = ({ status }: { status: HealthStatus }) => {
  if (status === 'ok') return <CheckCircle2Icon className="size-4 text-emerald-500" />;
  if (status === 'degraded') return <TriangleAlertIcon className="size-4 text-amber-500" />;
  if (status === 'down') return <XCircleIcon className="size-4 text-destructive" />;
  return <Loader2Icon className="size-4 text-muted-foreground" />;
};

const statusColor = (status: HealthStatus): string => {
  if (status === 'ok') return 'text-emerald-500';
  if (status === 'degraded') return 'text-amber-500';
  if (status === 'down') return 'text-destructive';
  return 'text-muted-foreground';
};

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
};

export const ServerHealthBadge = ({ serverId }: Props) => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runProbe = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/servers/${serverId}/health`, {
          cache: 'no-store',
          signal,
        });
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(`http_${res.status}`);
          setData(null);
        } else {
          const body = (await res.json()) as HealthResponse;
          setError(null);
          setData(body);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError('network_error');
        setData(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [serverId],
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    void runProbe();
  }, [runProbe]);

  useEffect(() => {
    const ctrl = new AbortController();
    // The `react-hooks/set-state-in-effect` lint rule fires on memoized
    // setState-callers invoked directly in an effect body. Deferring through
    // a microtask moves the first setState out of the synchronous effect
    // window. Non-obvious but load-bearing; don't remove without verifying
    // `pnpm lint` stays green.
    queueMicrotask(() => {
      if (ctrl.signal.aborted) return;
      void runProbe(ctrl.signal);
    });
    return () => ctrl.abort();
  }, [runProbe]);

  const status: HealthStatus = data?.status ?? 'unknown';
  const showLatency = data?.latencyMs !== undefined && status !== 'unknown';

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon status={loading ? 'unknown' : status} />
        <span className={cn('font-medium', statusColor(loading ? 'unknown' : status))}>
          {loading ? 'Checking…' : error ? 'Error' : STATUS_TEXT[status]}
        </span>
        {showLatency ? (
          <span className="font-mono text-xs text-muted-foreground">
            {data?.latencyMs}ms
          </span>
        ) : null}
        {data?.checkedAt ? (
          <span className="text-xs text-muted-foreground">
            · checked {formatTime(data.checkedAt)}
          </span>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
        aria-label="Refresh origin health"
      >
        <RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  );
};
