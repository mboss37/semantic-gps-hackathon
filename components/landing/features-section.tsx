'use client';

import { useEffect, useRef, useState } from 'react';

type Feature = {
  title: string;
  lede: string;
  bullets: readonly string[];
  visual: 'policy' | 'route' | 'rollback' | 'audit';
};

const FEATURES: readonly Feature[] = [
  {
    title: 'Change rules without redeploying agents',
    lede:
      'Policies live in the gateway, not in Claude prompts, Cursor instructions, or custom agent code. Shadow first, enforce when the audit proves it is safe.',
    bullets: [
      'Flip a policy between shadow and enforce through the dashboard.',
      'Apply controls per server or per tool without changing the MCP origin.',
      'Use shipped runners for PII, injection guard, rate, time, identity, IP, geo, write-freeze, and idempotency.',
    ],
    visual: 'policy',
  },
  {
    title: 'Validate the workflow before the call runs',
    lede:
      'Agents can ask the gateway how tools relate, then preflight a proposed route before it touches a production system.',
    bullets: [
      'Expose `discover_relationships`, `find_workflow_path`, and `validate_workflow` on the MCP endpoint.',
      'Represent tool dependencies with typed edges like `requires_before`, `validates`, and `produces_input_for`.',
      'Keep the agent layer generic while the gateway owns routing knowledge.',
    ],
    visual: 'route',
  },
  {
    title: 'Recover when a multi-step action breaks',
    lede:
      '`execute_route` runs governed workflows with fallback and compensating rollback paths, all tied together by one trace.',
    bullets: [
      'Walk `fallback_to` routes on origin errors and log `fallback_triggered` events.',
      'Undo completed steps through `compensated_by` relationships when a route halts.',
      'Map rollback arguments explicitly with `rollback_input_mapping`, not guesswork.',
    ],
    visual: 'rollback',
  },
  {
    title: 'Give compliance a trace, not a screenshot',
    lede:
      'Every gateway interaction writes method, tool, latency, status, and policy decisions into the audit log.',
    bullets: [
      'Filter events by trace, server, tool, status, and time range.',
      'Review per-policy decision timelines from the events table.',
      'Log redacted payloads so the audit trail does not become a new secret store.',
    ],
    visual: 'audit',
  },
];

const DECISIONS = [
  { label: 'pii_redaction', mode: 'shadow', status: 'observed' },
  { label: 'agent_identity_required', mode: 'enforce', status: 'allowed' },
  { label: 'business_hours', mode: 'enforce', status: 'blocked' },
] as const;

const ROUTE_STEPS = ['discover_relationships', 'validate_workflow', 'execute_route'] as const;

const TRACE_ROWS = [
  { method: 'tools/call', status: 'ok', latency: '184ms' },
  { method: 'execute_route.step', status: 'ok', latency: '311ms' },
  { method: 'execute_route.rollback', status: 'ok', latency: '205ms' },
] as const;

const statusColor = (status: string) => {
  if (status === 'blocked') return 'text-red-300 border-red-500/20 bg-red-500/10';
  if (status === 'observed') return 'text-amber-200 border-amber-400/20 bg-amber-400/10';
  return 'text-emerald-200 border-emerald-400/20 bg-emerald-400/10';
};

const PolicyConsole = () => (
  <div className="space-y-3">
    {DECISIONS.map((decision) => (
      <div
        key={decision.label}
        className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border border-border bg-card/35 p-4"
      >
        <div>
          <p className="font-mono text-xs text-foreground/80">{decision.label}</p>
          <p className="mt-1.5 text-sm text-foreground/42">mode: {decision.mode}</p>
        </div>
        <span
          className={`self-start rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusColor(
            decision.status
          )}`}
        >
          {decision.status}
        </span>
      </div>
    ))}
    <div className="h-1.5 overflow-hidden rounded-full bg-card">
      <div className="h-full w-2/3 rounded-full bg-foreground/55" />
    </div>
  </div>
);

const RouteConsole = () => (
  <div className="space-y-4">
    {ROUTE_STEPS.map((step, index) => (
      <div key={step} className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card/35 font-mono text-xs text-foreground/48">
          0{index + 1}
        </div>
        <div className="flex-1 rounded-lg border border-border bg-card/35 px-4 py-3">
          <p className="font-mono text-xs text-foreground/80">{step}</p>
          <p className="mt-1.5 text-sm text-foreground/42">
            {index === 0 ? 'load graph' : index === 1 ? 'preflight plan' : 'run governed route'}
          </p>
        </div>
      </div>
    ))}
  </div>
);

const RollbackConsole = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-3 gap-2">
      {['step 1', 'step 2', 'halt'].map((step, index) => (
        <div
          key={step}
          className={`rounded-lg border p-4 text-center font-mono text-sm ${
            index === 2
              ? 'border-red-500/25 bg-red-500/10 text-red-200'
              : 'border-border bg-card/30 text-foreground/65'
          }`}
        >
          {step}
        </div>
      ))}
    </div>
    <div className="rounded-xl border border-border bg-card/25 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/40">
          rollback path
        </span>
        <span className="rounded-full border border-(--brand)/20 bg-(--brand)/10 px-2 py-0.5 font-mono text-[10px] text-(--brand)">
          compensated_by
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-foreground/55">
        <span className="h-px flex-1 bg-border" />
        <span>reverse walk</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
    <p className="font-mono text-[11px] text-foreground/40">
      rollback_input_mapping resolved before compensator call
    </p>
  </div>
);

const AuditConsole = () => (
  <div className="space-y-3">
    {TRACE_ROWS.map((row) => (
      <div
        key={`${row.method}-${row.latency}`}
        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-border bg-card/30 px-3 py-2.5"
      >
        <span className="font-mono text-[11px] text-foreground/70">{row.method}</span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
          {row.status}
        </span>
        <span className="font-mono text-[10px] text-foreground/35">{row.latency}</span>
      </div>
    ))}
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="font-mono text-foreground/45">policy_decisions</span>
        <span className="font-mono text-foreground/35">trace_id</span>
      </div>
      <div className="h-14 rounded-md bg-card/35 p-2">
        <div className="h-2 w-5/6 rounded bg-foreground/10" />
        <div className="mt-2 h-2 w-2/3 rounded bg-foreground/10" />
        <div className="mt-2 h-2 w-1/2 rounded bg-(--brand)/30" />
      </div>
    </div>
  </div>
);

const ConsoleVisual = ({ type }: { type: Feature['visual'] }) => {
  if (type === 'policy') return <PolicyConsole />;
  if (type === 'route') return <RouteConsole />;
  if (type === 'rollback') return <RollbackConsole />;
  return <AuditConsole />;
};

const FeatureVisualFrame = ({ feature }: { feature: Feature }) => (
  <div className="group relative w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-background transition-colors duration-300 hover:border-foreground/20">
    <div className="border-b border-border bg-card/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/40">
          gateway console
        </span>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground/45">
          live
        </span>
      </div>
    </div>
    <div className="min-h-[360px] p-6">
      <ConsoleVisual type={feature.visual} />
    </div>
  </div>
);

const FeatureRow = ({ feature, index }: { feature: Feature; index: number }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const reverse = index % 2 === 1;

  return (
    <div
      ref={rowRef}
      className={`transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div
        className={`grid border-t border-border py-16 lg:py-24 xl:grid-cols-2 xl:gap-24 ${
          reverse ? 'xl:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div className="flex flex-col justify-center">
          <h3 className="mb-5 max-w-xl text-3xl font-medium leading-tight tracking-tight text-foreground md:text-4xl">
            {feature.title}
          </h3>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-foreground/60 md:text-lg">
            {feature.lede}
          </p>
          <ul className="space-y-3">
            {feature.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-sm leading-[1.6] text-foreground/72">
                <span className="mt-[9px] size-1 rounded-full bg-foreground/40 shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex items-center justify-center xl:mt-0">
          <FeatureVisualFrame feature={feature} />
        </div>
      </div>
    </div>
  );
};

export const FeaturesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHeaderVisible(true);
      },
      { threshold: 0.1 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="relative py-20 lg:py-32">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div
          className={`mb-8 max-w-3xl transition-all duration-500 ${
            headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-foreground/50">
            Capabilities
          </p>
          <h2 className="mb-5 text-[38px] font-medium leading-[1.05] tracking-[-0.03em] text-foreground md:text-[52px]">
            Gateway controls that stay out of the agent code.
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/60">
            The shipped gateway governs calls, validates routes, records decisions, and recovers
            failed workflows while your agents and MCP servers keep their own release cycles.
          </p>
        </div>

        <div>
          {FEATURES.map((feature, i) => (
            <FeatureRow key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};
