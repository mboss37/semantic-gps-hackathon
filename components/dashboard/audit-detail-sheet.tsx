'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AuditEvent } from '@/lib/schemas/audit-event';

// Sprint 22 WP-22.2: detail drawer for /dashboard/audit. Receives an event id;
// fetches /api/audit/[id]; renders status + policy verdicts + redacted payload
// in a right-side Radix Sheet. Built for the demo recording — judges expect a
// side-slider inspector on a governance product.

type AuditEventDetail = AuditEvent & {
  payload_redacted: unknown;
};

type Props = {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
};

const STATUS_COLOR: Record<string, string> = {
  ok: 'border-emerald-500/30 text-emerald-400',
  blocked_by_policy: 'border-amber-500/30 text-amber-400',
  origin_error: 'border-red-500/30 text-red-400',
  fallback_triggered: 'border-blue-500/30 text-blue-400',
  invalid_input: 'border-amber-500/30 text-amber-400',
  unauthorized: 'border-red-500/30 text-red-400',
};

export const AuditDetailSheet = ({ eventId, onOpenChange }: Props) => {
  // `detail` is keyed by eventId — when the eventId in `detail` doesn't match
  // the current prop, we know the data is stale (still fetching the new id).
  // This avoids a synchronous setState reset in the effect body (which the
  // react-hooks/set-state-in-effect lint rule rightly flags) while still
  // preventing a flash of the previous payload when the sheet reopens with
  // a different event.
  const [detail, setDetail] = useState<AuditEventDetail | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (eventId === null) return;
    const targetId = eventId;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/audit/${targetId}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Event not found' : `HTTP ${res.status}`);
        }
        const body = (await res.json()) as { event: AuditEventDetail };
        if (!cancelled) {
          setDetail(body.event);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError({ id: targetId, message: e instanceof Error ? e.message : 'Load failed' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const isStale = detail !== null && eventId !== null && detail.id !== eventId;
  const showDetail = eventId !== null && !isStale && detail !== null;
  const showError = eventId !== null && error !== null && error.id === eventId;
  const showLoading = eventId !== null && !showDetail && !showError;

  const copyTraceId = () => {
    if (!detail) return;
    void navigator.clipboard.writeText(detail.trace_id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Sheet open={eventId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Audit detail</SheetTitle>
          <SheetDescription>
            Full request, policy verdicts, and redacted payload for this gateway call.
          </SheetDescription>
        </SheetHeader>

        {showLoading && <p className="px-4 text-sm text-muted-foreground">Loading…</p>}
        {showError && error && <p className="px-4 text-sm text-red-400">{error.message}</p>}
        {showDetail && detail && (
          <div className="flex flex-col gap-6 px-4 pb-6 text-sm">
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={STATUS_COLOR[detail.status] ?? ''}>
                  {detail.status}
                </Badge>
                <span className="font-mono text-xs">{detail.method}</span>
                {detail.tool_name && (
                  <span className="text-muted-foreground">· {detail.tool_name}</span>
                )}
                {detail.latency_ms !== null && (
                  <span className="ml-auto text-muted-foreground">{detail.latency_ms}ms</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(detail.created_at).toLocaleString()}
              </p>
            </section>

            {detail.policy_decisions.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Policy verdicts
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {detail.policy_decisions.map((d, i) => {
                    const decision = (d as { decision?: string }).decision;
                    const mode = (d as { mode?: string }).mode;
                    const name = (d as { policy_name?: string }).policy_name;
                    const reason = (d as { reason?: string }).reason;
                    return (
                      <li
                        key={i}
                        className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{decision}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{mode}</span>
                        </div>
                        {reason && <p className="mt-1 text-muted-foreground">{reason}</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {detail.payload_redacted !== null && detail.payload_redacted !== undefined && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payload (redacted)
                </h3>
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(detail.payload_redacted, null, 2)}
                </pre>
              </section>
            )}

            <section className="flex items-center gap-2 border-t pt-4">
              <span className="text-xs text-muted-foreground">trace_id</span>
              <code className="font-mono text-xs">{detail.trace_id}</code>
              <button
                onClick={copyTraceId}
                className="ml-auto rounded-md border bg-muted/30 px-2 py-1 text-xs hover:bg-muted/50"
                title="Copy trace_id"
              >
                {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
              </button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
