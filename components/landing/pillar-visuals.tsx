import { ArrowRightIcon, SparklesIcon, ShieldCheckIcon, XCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PolicyRibbon } from '@/components/landing/policy-ribbon';

// Pillar-specific inline visuals for the landing page. Kept colocated here
// so page.tsx stays under the 400-line cap + the visuals can evolve
// (screenshots, GIFs, live demos) without editing page structure.

export const Pillar1Visual = () => (
  <div className="rounded-xl border border-border shadow-xl bg-card overflow-hidden">
    <div className="grid grid-rows-2 divide-y divide-border">
      {[
        {
          label: 'RAW',
          accent: 'text-red-500',
          icon: XCircleIcon,
          phone: '(555) 123-4567',
          phoneFill: 'text-red-500',
          note: 'Agent reads PII, drafts SMS.',
        },
        {
          label: 'GOVERNED',
          accent: 'text-emerald-500',
          icon: ShieldCheckIcon,
          phone: '[redacted:phone]',
          phoneFill: 'text-emerald-500',
          note: 'PII never enters agent context.',
        },
      ].map((row) => {
        const Icon = row.icon;
        return (
          <div key={row.label} className="p-6 md:p-8 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${row.accent}`} aria-hidden />
              <span className={`text-xs font-bold uppercase tracking-widest ${row.accent}`}>
                {row.label}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-8 shrink-0 rounded-full bg-muted" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Alex from Acme · just now</span>
                <p className="text-sm">
                  Can you reach out to Sam about the renewal? Best number is{' '}
                  <span className={`font-semibold ${row.phoneFill}`}>{row.phone}</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic pl-11">{row.note}</p>
          </div>
        );
      })}
    </div>
  </div>
);

export const Pillar2Visual = () => (
  <div className="rounded-xl border border-border shadow-xl bg-card p-6 md:p-8 flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <Badge variant="outline" className="gap-1.5 text-xs">
        <SparklesIcon className="size-3 text-[var(--brand)]" />
        Opus 4.7 · extended thinking · 2048 tokens
      </Badge>
      <span className="text-xs text-muted-foreground">/dashboard/playground</span>
    </div>
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: 'RAW', border: 'border-red-500/40', bg: 'bg-red-500/5' },
        { label: 'GOVERNED', border: 'border-emerald-500/40', bg: 'bg-emerald-500/5' },
      ].map((pane) => (
        <div
          key={pane.label}
          className={`rounded-md border ${pane.border} ${pane.bg} p-4 flex flex-col gap-3`}
        >
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
            {pane.label}
          </span>
          <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
            <div>› tools/call find_contact</div>
            <div>› tools/call chat_post_message</div>
            {pane.label === 'GOVERNED' ? (
              <div className="text-emerald-400">policy: pii_redaction allow</div>
            ) : (
              <div className="text-red-400">leaked: phone pattern</div>
            )}
          </div>
        </div>
      ))}
    </div>
    <PolicyRibbon />
  </div>
);

export const Pillar3Visual = () => (
  <div className="rounded-xl border border-border shadow-xl bg-card p-6 md:p-8 flex flex-col gap-6">
    <div className="flex items-center gap-3 flex-wrap">
      {[
        { label: '1 · find_contact', state: 'ok' },
        { label: '2 · create_task', state: 'ok' },
        { label: '3 · create_issue', state: 'fail' },
        { label: '4 · notify', state: 'pending' },
      ].map((step) => {
        const colors = {
          ok: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
          fail: 'border-red-500/60 bg-red-500/15 text-red-300',
          pending: 'border-border bg-muted/20 text-muted-foreground',
        } as const;
        return (
          <div
            key={step.label}
            className={`rounded-md border px-3 py-2 text-xs font-mono ${
              colors[step.state as keyof typeof colors]
            }`}
          >
            {step.label}
          </div>
        );
      })}
    </div>
    <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
      <ArrowRightIcon className="size-3 rotate-180" aria-hidden />
      compensated_by → close_issue → delete_task
    </div>
    <pre className="font-mono text-[11px] md:text-xs bg-muted/40 rounded-md border border-border p-4 overflow-x-auto leading-relaxed">
{`rollback_input_mapping: {
  "issue_number": "$steps.create_issue.result.number",
  "owner":        "$steps.create_issue.args.owner",
  "repo":         "$steps.create_issue.args.repo"
}`}
    </pre>
  </div>
);

export const Pillar4Visual = () => (
  <div className="rounded-xl border border-border shadow-xl bg-card p-6 md:p-8 flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-mono">/dashboard/monitoring</span>
      <Badge variant="outline" className="text-xs">
        Last 7 days
      </Badge>
    </div>
    <div className="space-y-3">
      {[
        { label: 'ok', value: 92, color: '#22c55e' },
        { label: 'blocked', value: 5, color: '#ef4444' },
        { label: 'error', value: 3, color: '#f59e0b' },
      ].map((bar) => (
        <div key={bar.label} className="flex items-center gap-3 text-xs font-mono">
          <span className="w-16 text-muted-foreground uppercase tracking-wide">{bar.label}</span>
          <div className="flex-1 h-6 rounded-sm bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-sm"
              style={{ width: `${bar.value}%`, backgroundColor: bar.color }}
            />
          </div>
          <span className="w-10 text-right text-muted-foreground">{bar.value}%</span>
        </div>
      ))}
    </div>
    <div className="pt-3 border-t border-border space-y-2">
      {[
        { trace: 'a4d9...', method: 'tools/call', tool: 'find_contact', decision: 'allow', latency: '248ms' },
        { trace: '7b15...', method: 'tools/call', tool: 'create_issue', decision: 'blocked', latency: '12ms' },
        { trace: '1278...', method: 'tools/list', tool: '—', decision: 'allow', latency: '31ms' },
      ].map((row) => (
        <div key={row.trace} className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-muted-foreground">{row.trace}</span>
          <span className="text-foreground">{row.method}</span>
          <span className="text-muted-foreground">{row.tool}</span>
          <Badge
            variant="outline"
            className={`ml-auto text-[10px] ${
              row.decision === 'blocked'
                ? 'text-red-400 border-red-500/50'
                : 'text-emerald-400 border-emerald-500/50'
            }`}
          >
            {row.decision}
          </Badge>
          <span className="text-muted-foreground w-12 text-right">{row.latency}</span>
        </div>
      ))}
    </div>
  </div>
);
