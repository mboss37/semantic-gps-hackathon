'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const STATUS_TTL_MS = 8_000;

type PreviewTool = { name: string; description: string | null };

type PreviewUpdate = {
  name: string;
  old: { description: string | null };
  new: { description: string | null };
};

type DiffPreview = {
  toAdd: PreviewTool[];
  toUpdate: PreviewUpdate[];
  stale: PreviewTool[];
};

type ApplyResult = { added: number; updated: number; stale: number };

type Props = { serverId: string };

export const ServerRediscoverButton = ({ serverId }: Props) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<DiffPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/rediscover`, {
        method: 'GET',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        setError(body?.reason ?? body?.error ?? `http_${res.status}`);
        return;
      }
      const body = (await res.json()) as DiffPreview;
      setPreview(body);
      setDialogOpen(true);
    } catch {
      setError('network_error');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/rediscover`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        setError(body?.reason ?? body?.error ?? `http_${res.status}`);
        return;
      }
      const body = (await res.json()) as ApplyResult;
      setResult(body);
      setDialogOpen(false);
      setPreview(null);
      router.refresh();
    } catch {
      setError('network_error');
    } finally {
      setApplying(false);
    }
  }, [router, serverId]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setPreview(null);
  }, []);

  useEffect(() => {
    if (!result && !error) return;
    const timer = setTimeout(() => {
      setResult(null);
      setError(null);
    }, STATUS_TTL_MS);
    return () => clearTimeout(timer);
  }, [result, error]);

  const totalChanges = preview
    ? preview.toAdd.length + preview.toUpdate.length + preview.stale.length
    : 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreview}
        disabled={loading || applying}
      >
        <RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />
        Rediscover tools
      </Button>

      {error ? (
        <span className="text-xs text-destructive">Error: {error}</span>
      ) : result ? (
        <span className="text-xs text-muted-foreground">
          +{result.added} added &middot; {result.updated} updated &middot;{' '}
          {result.stale} stale
        </span>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediscover tools</DialogTitle>
            <DialogDescription>
              {totalChanges === 0
                ? 'No changes detected. Tools are up to date.'
                : `${totalChanges} change${totalChanges === 1 ? '' : 's'} found.`}
            </DialogDescription>
          </DialogHeader>

          {preview && totalChanges > 0 && (
            <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
              {preview.toAdd.length > 0 && (
                <div>
                  <p className="font-medium text-green-600">
                    +{preview.toAdd.length} to add
                  </p>
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {preview.toAdd.map((t) => (
                      <li key={t.name}>{t.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.toUpdate.length > 0 && (
                <div>
                  <p className="font-medium text-yellow-600">
                    {preview.toUpdate.length} to update
                  </p>
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {preview.toUpdate.map((t) => (
                      <li key={t.name}>
                        {t.name}
                        {t.old.description !== t.new.description && (
                          <span className="block text-xs">
                            &ldquo;{t.old.description ?? '(none)'}&rdquo; &rarr;{' '}
                            &ldquo;{t.new.description ?? '(none)'}&rdquo;
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.stale.length > 0 && (
                <div>
                  <p className="font-medium text-red-600">
                    {preview.stale.length} stale (not deleted)
                  </p>
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {preview.stale.map((t) => (
                      <li key={t.name}>{t.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={applying}>
              Cancel
            </Button>
            {totalChanges > 0 && (
              <Button onClick={handleApply} disabled={applying}>
                {applying ? 'Applying...' : 'Apply changes'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
