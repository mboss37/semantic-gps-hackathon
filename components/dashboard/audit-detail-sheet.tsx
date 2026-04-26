'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  EyeOffIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { statusBadgeClassFor } from '@/lib/charts/palette';
import type { AuditEvent } from '@/lib/schemas/audit-event';
import { cn } from '@/lib/utils';

// Visual hierarchy on policy verdicts. The audit panel must answer "which
// policy was the cause of the block?" at a glance, without forcing the
// reader to parse `decision` + `mode` text on every row. Mapping:
//   block + enforce → red, ShieldAlert, "CAUSE" pill, actually halted the call
//   block + shadow  → amber, TriangleAlert, "WOULD BLOCK · SHADOW"
//   redact          → orange, EyeOff, post-call PII redaction landed
//   allow           → muted, CheckCircle2, ran clean, no action
const verdictStyle = (decision: string, mode: string) => {
  if (decision === 'block' && mode === 'enforce') {
    return {
      Icon: ShieldAlertIcon,
      container: 'border-red-500/40 bg-red-500/[0.08]',
      icon: 'text-red-400',
      name: 'text-red-100',
      decision: 'font-semibold text-red-300',
      reason: 'text-red-200/90',
      pill: 'border-red-500/50 bg-red-500/15 text-red-200',
      pillLabel: 'Cause',
    };
  }
  if (decision === 'block' && mode === 'shadow') {
    return {
      Icon: TriangleAlertIcon,
      container: 'border-amber-500/30 bg-amber-500/[0.05]',
      icon: 'text-amber-400',
      name: '',
      decision: 'text-amber-300',
      reason: 'text-amber-200/80',
      pill: 'border-amber-500/30 bg-amber-500/10 text-amber-200/90',
      pillLabel: 'Would block',
    };
  }
  if (decision === 'redact') {
    return {
      Icon: EyeOffIcon,
      container: 'border-orange-500/30 bg-orange-500/[0.05]',
      icon: 'text-orange-400',
      name: '',
      decision: 'text-orange-300',
      reason: 'text-orange-200/80',
      pill: 'border-orange-500/30 bg-orange-500/10 text-orange-200/90',
      pillLabel: 'Redacted',
    };
  }
  return {
    Icon: CheckCircle2Icon,
    container: 'border-border/40 bg-muted/20',
    icon: 'text-emerald-400/70',
    name: 'text-foreground/80',
    decision: 'text-muted-foreground',
    reason: 'text-muted-foreground',
    pill: '',
    pillLabel: '',
  };
};

// Sprint 22 WP-22.2: detail drawer for /dashboard/audit. Receives an event id;
// fetches /api/audit/[id]; renders status + policy verdicts + redacted payload
// in a right-side Radix Sheet. Built for the demo recording, judges expect a
// side-slider inspector on a governance product.

type AuditEventDetail = AuditEvent & {
  payload_redacted: unknown;
};

type Props = {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
};

export const AuditDetailSheet = ({ eventId, onOpenChange }: Props) => {
  // `detail` is keyed by eventId, when the eventId in `detail` doesn't match
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
                <Badge variant="outline" className={statusBadgeClassFor(detail.status)}>
                  {detail.status}
                </Badge>
                <span className="font-mono text-xs">{detail.method}</span>
                {detail.server_name && (
                  <span className="text-muted-foreground">· {detail.server_name}</span>
                )}
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
                    const decision = (d as { decision?: string }).decision ?? '';
                    const mode = (d as { mode?: string }).mode ?? '';
                    const name = (d as { policy_name?: string }).policy_name ?? '';
                    const reason = (d as { reason?: string }).reason;
                    const style = verdictStyle(decision, mode);
                    const Icon = style.Icon;
                    return (
                      <li
                        key={i}
                        className={cn('rounded-md border px-3 py-2 text-xs', style.container)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={cn('size-3.5 shrink-0', style.icon)} />
                          <span className={cn('font-medium', style.name)}>{name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={style.decision}>{decision}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{mode}</span>
                          {style.pillLabel && (
                            <span
                              className={cn(
                                'ml-auto rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider',
                                style.pill,
                              )}
                            >
                              {style.pillLabel}
                            </span>
                          )}
                        </div>
                        {reason && <p className={cn('mt-1', style.reason)}>{reason}</p>}
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
