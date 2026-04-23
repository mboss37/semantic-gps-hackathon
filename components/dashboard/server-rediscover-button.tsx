'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_TTL_MS = 8_000;

// Sprint 14 WP-14.3: POST /api/servers/[id]/rediscover. On success,
// router.refresh() re-renders the Server Component with the new tool list
// without a hard reload.

type Result = { added: number; updated: number; stale: number };

type Props = { serverId: string };

export const ServerRediscoverButton = ({ serverId }: Props) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRediscover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/rediscover`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; reason?: string } | null;
        setResult(null);
        setError(body?.reason ?? body?.error ?? `http_${res.status}`);
        return;
      }
      const body = (await res.json()) as Result;
      setResult(body);
      router.refresh();
    } catch {
      setResult(null);
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }, [router, serverId]);

  useEffect(() => {
    if (!result && !error) return;
    const timer = setTimeout(() => {
      setResult(null);
      setError(null);
    }, STATUS_TTL_MS);
    return () => clearTimeout(timer);
  }, [result, error]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRediscover}
        disabled={loading}
      >
        <RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />
        Rediscover tools
      </Button>
      {error ? (
        <span className="text-xs text-destructive">Error: {error}</span>
      ) : result ? (
        <span className="text-xs text-muted-foreground">
          +{result.added} added · {result.updated} updated · {result.stale} stale
        </span>
      ) : null}
    </div>
  );
};
