'use client';

import { Badge } from '@/components/ui/badge';
import type { AuditEvent } from '@/lib/schemas/audit-event';

const STATUS_COLOR: Record<string, string> = {
  ok: 'border-emerald-500/30 text-emerald-400',
  blocked_by_policy: 'border-amber-500/30 text-amber-400',
  origin_error: 'border-red-500/30 text-red-400',
  fallback_triggered: 'border-blue-500/30 text-blue-400',
  invalid_input: 'border-amber-500/30 text-amber-400',
  unauthorized: 'border-red-500/30 text-red-400',
};

type Props = {
  event: AuditEvent;
  onTraceClick: (traceId: string) => void;
};

export const AuditRow = ({ event, onTraceClick }: Props) => {
  const statusClass = STATUS_COLOR[event.status] ?? '';
  return (
    <li className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 text-muted-foreground">
          {new Date(event.created_at).toLocaleTimeString()}
        </span>
        <Badge variant="outline" className={statusClass}>
          {event.status}
        </Badge>
        <span className="font-mono">{event.method}</span>
        {event.tool_name && (
          <span className="text-muted-foreground">· {event.tool_name}</span>
        )}
        {event.latency_ms !== null && (
          <span className="ml-auto text-muted-foreground">{event.latency_ms}ms</span>
        )}
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onTraceClick(event.trace_id)}
          title="Filter by this trace"
        >
          trace {event.trace_id.slice(0, 8)}…
        </button>
      </div>
      {event.policy_decisions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {event.policy_decisions.map((d, i) => {
            const decision = (d as { decision?: string }).decision;
            const mode = (d as { mode?: string }).mode;
            const name = (d as { policy_name?: string }).policy_name;
            return (
              <span key={i} className="rounded bg-muted px-1.5 py-0.5">
                {name} · {decision} · {mode}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
};
