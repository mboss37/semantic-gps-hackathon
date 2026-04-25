'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { AuditDetailSheet } from '@/components/dashboard/audit-detail-sheet';
import { AuditTimelineChart } from '@/components/dashboard/audit-timeline-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { AuditTimelineBucket } from '@/lib/audit/timeline';
import { statusBadgeClassFor } from '@/lib/charts/palette';
import {
  MONITORING_RANGES,
  RANGE_LABEL,
  isMonitoringRange,
  type MonitoringRange,
} from '@/lib/monitoring/range';
import type { AuditEvent } from '@/lib/schemas/audit-event';

const POLL_MS = 1000;

type Filter = 'all' | 'ok' | 'blocked' | 'errors' | 'fallbacks' | 'rollbacks';

const matchesFilter = (event: AuditEvent, filter: Filter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'ok') return event.status === 'ok';
  if (filter === 'blocked') return event.status === 'blocked_by_policy';
  if (filter === 'fallbacks') return event.status === 'fallback_triggered';
  if (filter === 'rollbacks') return event.status === 'rollback_executed';
  if (filter === 'errors') {
    return (
      event.status === 'origin_error' ||
      event.status === 'invalid_input' ||
      event.status === 'unauthorized'
    );
  }
  return true;
};

const isFilter = (value: string): value is Filter =>
  value === 'all' ||
  value === 'ok' ||
  value === 'blocked' ||
  value === 'errors' ||
  value === 'fallbacks' ||
  value === 'rollbacks';

const AuditPage = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [timeline, setTimeline] = useState<AuditTimelineBucket[]>([]);
  const [total, setTotal] = useState(0);
  const [traceId, setTraceId] = useState('');
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // null = "let server auto-pick the smallest range that contains data".
  // Synced from response on first load; user clicks set it explicitly.
  const [range, setRange] = useState<MonitoringRange | null>(null);

  const load = useCallback(
    async (tid: string, r: MonitoringRange | null, quiet = true) => {
      try {
        const qs = new URLSearchParams();
        if (tid) qs.set('trace_id', tid);
        if (r) qs.set('range', r);
        qs.set('limit', '500');
        const res = await fetch(`/api/audit?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          events: AuditEvent[];
          total: number;
          timeline: AuditTimelineBucket[];
          range: MonitoringRange;
        };
        setEvents(data.events);
        setTimeline(data.timeline);
        setTotal(data.total);
        if (r === null && data.range) setRange(data.range);
      } catch (e) {
        if (!quiet) {
          toast.error(e instanceof Error ? e.message : 'Load failed');
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(traceId, range, true);
  }, [load, traceId, range]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      void load(traceId, range, true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [paused, load, traceId, range]);

  const filteredEvents = useMemo(
    () => events.filter((e) => matchesFilter(e, filter)),
    [events, filter],
  );

  const handleRangeChange = (value: string) => {
    if (!value) return;
    if (isMonitoringRange(value)) setRange(value);
  };

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
        <ToggleGroup
          type="single"
          value={range ?? ''}
          onValueChange={handleRangeChange}
          variant="outline"
          size="sm"
        >
          {MONITORING_RANGES.map((r) => (
            <ToggleGroupItem key={r} value={r} className="px-3">
              {RANGE_LABEL[r]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>

      <AuditTimelineChart series={timeline} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="trace-filter" className="text-xs text-muted-foreground">
                Filter trace_id
              </Label>
              <Input
                id="trace-filter"
                placeholder="uuid…"
                className="w-72 font-mono text-xs"
                value={traceId}
                onChange={(e) => setTraceId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load(traceId, range, false);
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTraceId('');
                void load('', range, false);
              }}
            >
              <FilterIcon className="size-4" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
              <RefreshCwIcon className={`size-4 ${paused ? '' : 'animate-spin'}`} />
              {paused ? 'Resume' : 'Pause'}
            </Button>
          </div>
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => {
              if (v && isFilter(v)) setFilter(v);
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="ok">Allowed</ToggleGroupItem>
            <ToggleGroupItem value="blocked">Blocked</ToggleGroupItem>
            <ToggleGroupItem value="errors">Errors</ToggleGroupItem>
            <ToggleGroupItem value="fallbacks">Fallbacks</ToggleGroupItem>
            <ToggleGroupItem value="rollbacks">Rollbacks</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filteredEvents.length} of {total.toLocaleString()}
        </p>

        {loading && events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {events.length === 0 ? 'No events in this window.' : 'No events match this filter.'}
            </p>
            {events.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Every gateway call — allowed, blocked, errored — lands here. Try a preset in the{' '}
                <a
                  href="/dashboard/playground"
                  className="text-foreground underline underline-offset-2"
                >
                  Playground
                </a>{' '}
                or hit <code className="rounded bg-muted px-1 font-mono">/api/mcp</code> from any
                MCP client.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-24 text-xs">Time</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs">Tool</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Latency</TableHead>
                  <TableHead className="text-xs">Trace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                  const statusClass = statusBadgeClassFor(event.status);
                  return (
                    <TableRow
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedEventId(event.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{event.method}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.tool_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusClass} text-[10px]`}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {event.latency_ms !== null ? `${event.latency_ms}ms` : '—'}
                      </TableCell>
                      <TableCell>
                        <button
                          className="rounded-md border bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTraceId(event.trace_id);
                          }}
                          title="Filter by this trace"
                        >
                          {event.trace_id.slice(0, 8)}…
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AuditDetailSheet
        eventId={selectedEventId}
        onOpenChange={(open) => {
          if (!open) setSelectedEventId(null);
        }}
      />
    </div>
  );
};

export default AuditPage;
