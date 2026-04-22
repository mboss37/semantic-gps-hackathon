'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AuditChart } from '@/components/dashboard/audit-chart';
import { AuditRow } from '@/components/dashboard/audit-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditEvent } from '@/lib/schemas/audit-event';

const POLL_MS = 1000;

const AuditPage = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [traceId, setTraceId] = useState('');
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (tid: string, quiet = true) => {
    try {
      const qs = new URLSearchParams();
      if (tid) qs.set('trace_id', tid);
      qs.set('limit', '50');
      const res = await fetch(`/api/audit?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { events: AuditEvent[]; total: number };
      setEvents(data.events);
      setTotal(data.total);
    } catch (e) {
      if (!quiet) {
        toast.error(e instanceof Error ? e.message : 'Load failed');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(traceId, true);
    const timer = setInterval(() => {
      void load(traceId, true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [paused, load, traceId]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }, [events]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every gateway call. Filter by <code className="text-zinc-300">trace_id</code> to
            reconstruct a workflow. {paused ? 'Polling paused.' : 'Polling every 1s.'}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="trace-filter" className="text-xs text-muted-foreground">
              Filter trace_id
            </Label>
            <Input
              id="trace-filter"
              placeholder="uuid…"
              className="w-80 font-mono text-xs"
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load(traceId, false);
              }}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setTraceId('');
              void load('', false);
            }}
          >
            <FilterIcon className="size-4" />
            Clear
          </Button>
          <Button variant="outline" onClick={() => setPaused((p) => !p)}>
            <RefreshCwIcon className={`size-4 ${paused ? '' : 'animate-spin'}`} />
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </header>

      <AuditChart data={statusCounts} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {events.length} of {total.toLocaleString()}
          </p>
        </div>
        {loading && events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No events yet. Hit the gateway from MCP Inspector or the demo agent to populate.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <AuditRow key={e.id} event={e} onTraceClick={setTraceId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default AuditPage;
