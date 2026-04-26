import Link from 'next/link';
import {
  ActivityIcon,
  ArrowRightIcon,
  GitBranchIcon,
  NetworkIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand-mark';

const SIDEBAR_SECTIONS = [
  {
    title: 'Overview',
    items: ['Dashboard'],
  },
  {
    title: 'Build',
    items: ['MCP Servers', 'Relationships', 'Routes', 'Tokens', 'Connect'],
  },
  {
    title: 'Governance',
    items: ['Policies'],
  },
  {
    title: 'Operate',
    items: ['Playground', 'Workflow Graph', 'Monitoring', 'Audit'],
  },
] as const;

const KPI_CARDS = [
  {
    label: 'MCP Servers',
    value: '6',
    detail: 'Connected endpoints',
    badge: 'Active',
    Icon: NetworkIcon,
  },
  {
    label: 'Tools Registered',
    value: '48',
    detail: 'Mapped by TRel',
    badge: '+12',
    Icon: GitBranchIcon,
  },
  {
    label: 'Active Policies',
    value: '12',
    detail: '4 enforcing, 8 observing',
    badge: 'Live',
    Icon: ShieldCheckIcon,
  },
  {
    label: 'Events (24h)',
    value: '1,284',
    detail: '99.2% completed',
    badge: '+18%',
    Icon: ActivityIcon,
  },
] as const;

const TRAFFIC_LINES = [
  {
    label: 'Allowed',
    path: 'M0 126 C42 126 84 126 126 126 C146 126 154 22 178 22 C203 22 211 126 232 126 C282 126 308 126 334 126 C352 126 360 78 383 78 C406 78 414 126 432 126',
  },
] as const;

const AUDIT_LOG_ROWS = [
  ['09:42:18', 'tools/call', 'salesforce.create_task', 'ok', '184ms'],
  ['09:41:57', 'policy/check', 'pii_redaction', 'blocked_by_policy', '36ms'],
  ['09:40:12', 'tools/call', 'slack.post_message', 'ok', '141ms'],
  ['09:38:44', 'relationships/query', 'find_workflow_path', 'ok', '96ms'],
  ['09:37:09', 'playground/run', 'raw_vs_governed', 'ok', '2.1s'],
] as const;

const statusTone = (status: (typeof AUDIT_LOG_ROWS)[number][3]) => {
  if (status === 'blocked_by_policy') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  }
  return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
};

const KpiCard = ({ card }: { card: (typeof KPI_CARDS)[number] }) => {
  const Icon = card.Icon;
  return (
    <div className="rounded-lg border border-white/10 bg-[#101010] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-white/42">{card.label}</p>
          <div className="mt-2 text-3xl font-semibold tracking-tighter text-white tabular-nums">
            {card.value}
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/52">
          {card.badge}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[12px] text-white/46">
        <Icon className="size-3.5" />
        {card.detail}
      </div>
    </div>
  );
};

const DashboardPreview = () => (
  <div className="relative mx-auto max-h-[640px] w-full max-w-6xl overflow-hidden rounded-xl border border-white/12 bg-[#050505] shadow-[0_40px_160px_rgba(0,0,0,0.58)]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_32%)]" />
    <div className="relative z-10 border-b border-white/10 bg-[#080808]/90 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-300/70" />
          <span className="size-2.5 rounded-full bg-emerald-300/70" />
        </div>
        <span className="font-mono text-[10px] tracking-[0.24em] text-white/34 uppercase">
          semantic-gps / dashboard
        </span>
      </div>
    </div>

    <div className="relative z-10 grid min-h-[780px] lg:grid-cols-[236px_1fr]">
      <aside className="hidden border-r border-white/10 bg-black/70 p-4 lg:block">
        <div className="mb-6 flex items-center gap-2 px-2">
          <BrandMark className="size-8" />
          <div>
            <p className="text-sm font-semibold text-white">Semantic GPS</p>
            <p className="text-[11px] text-white/34">Acme SalesOps</p>
          </div>
        </div>

        <div className="space-y-5">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[10px] font-medium tracking-[0.2em] text-white/28 uppercase">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item}
                    className={`rounded-md px-3 py-2 text-[12px] ${
                      item === 'Dashboard'
                        ? 'border border-white/10 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-white/42'
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0 bg-[#090909]">
        <div className="flex h-12 items-center justify-between border-b border-white/10 bg-black px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-300" />
            <span className="text-[12px] font-medium text-white/62">Dashboard</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">
            <SparklesIcon className="size-3" />
            Built with Opus 4.7
          </span>
        </div>

        <div className="space-y-4 p-4 lg:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] tracking-[0.2em] text-white/34 uppercase">
                Gateway overview
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
                Gateway traffic and audit activity.
              </h3>
            </div>
            <span className="w-fit rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200">
              All systems operational
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_CARDS.map((card) => (
              <KpiCard key={card.label} card={card} />
            ))}
          </div>

          <section className="rounded-xl border border-white/10 bg-[#101010] p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] tracking-[0.2em] text-white/34 uppercase">
                  Gateway traffic
                </p>
                <h4 className="mt-1 text-lg font-semibold tracking-tight text-white">
                  Calls over time, split by outcome
                </h4>
              </div>
              <div className="flex overflow-hidden rounded-md border border-white/10 bg-black text-[10px] text-white/52">
                {['15m', '30m', '1h', '6h', '24h', '7d'].map((range, index) => (
                  <span
                    key={range}
                    className={`border-r border-white/10 px-3 py-2 last:border-r-0 ${
                      index === 0 ? 'bg-white/10 text-white' : ''
                    }`}
                  >
                    {range}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative h-56 overflow-hidden rounded-lg border border-white/8 bg-black/40 px-5 pt-5 pb-8">
              <div className="absolute top-6 right-5 bottom-9 left-10">
                {[0, 1, 2, 3, 4].map((tick) => (
                  <div
                    key={tick}
                    className="absolute inset-x-0 border-t border-dashed border-white/5.5"
                    style={{ top: `${tick * 25}%` }}
                  />
                ))}
              </div>
              <div className="absolute top-5 bottom-9 left-3 flex flex-col justify-between text-[10px] text-white/28">
                {['4', '3', '2', '1', '0'].map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
              <svg
                viewBox="0 0 432 160"
                className="relative ml-5 h-[160px] w-[calc(100%-1.25rem)]"
                aria-hidden
              >
                {TRAFFIC_LINES.map((line) => (
                  <path
                    key={line.label}
                    d={line.path}
                    fill="none"
                    className="stroke-emerald-400"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
              <div className="absolute inset-x-10 bottom-4 flex justify-between text-[10px] text-white/26">
                {['21:26', '21:28', '21:30', '21:32', '21:34', '21:36', '21:38', '21:40'].map(
                  (label) => (
                    <span key={label}>{label}</span>
                  ),
                )}
              </div>
              <div className="absolute inset-x-0 bottom-1 flex justify-center text-[10px] text-white/52">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-emerald-400" />
                  Allowed
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#101010] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] tracking-[0.2em] text-white/34 uppercase">
                  Recent events
                </p>
                <h4 className="mt-1 text-lg font-semibold tracking-tight text-white">Audit log</h4>
              </div>
              <span className="rounded-full border border-white/10 bg-black px-2.5 py-1 text-[10px] text-white/42">
                50 rows
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/35">
              <div className="grid grid-cols-[90px_1.1fr_1.4fr_140px_80px] border-b border-white/10 px-4 py-2 text-[10px] tracking-[0.16em] text-white/30 uppercase">
                <span>Time</span>
                <span>Method</span>
                <span>Tool</span>
                <span>Status</span>
                <span className="text-right">Latency</span>
              </div>
              {AUDIT_LOG_ROWS.map(([time, method, tool, status, latency]) => (
                <div
                  key={`${time}-${method}-${tool}`}
                  className="grid grid-cols-[90px_1.1fr_1.4fr_140px_80px] items-center border-b border-white/8 px-4 py-3 last:border-b-0"
                >
                  <span className="font-mono text-[11px] text-white/40">{time}</span>
                  <span className="truncate font-mono text-[11px] text-white/72">{method}</span>
                  <span className="truncate text-[12px] text-white/48">{tool}</span>
                  <span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusTone(status)}`}
                    >
                      {status}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[11px] text-white/36">{latency}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>

    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-64 bg-linear-to-b from-transparent via-[#050505]/88 to-[#050505]" />
  </div>
);

const PROOF_CALLOUTS = [
  [ShieldCheckIcon, 'Policy blocked'],
  [GitBranchIcon, 'Rollback path found'],
  [ActivityIcon, 'Audit trail captured'],
] as const;

const HeroProofCallouts = () => (
  <div className="pointer-events-none absolute -top-4 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 md:flex">
    {PROOF_CALLOUTS.map(([Icon, label]) => (
      <span
        key={label}
        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/70 px-3 py-1.5 text-xs text-white/62 shadow-[0_12px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl"
      >
        <Icon className="size-3.5 text-blue-100/80" />
        {label}
      </span>
    ))}
  </div>
);

export const HeroSection = () => (
  <section className="relative isolate overflow-hidden pt-14">
    {/* Layered ambient: cyan primary bloom (matches BrandMark + incidents
        section radial), soft white off-center spotlight for depth, indigo
        accent on the right (matches BrandMark gradient endpoint), on a
        cooler-tinted black base. Ties the hero into the rest of the page
        palette without sacrificing the "above-the-fold spotlight" feel. */}
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-8%,rgba(125,211,252,0.14),transparent_38%),radial-gradient(circle_at_22%_22%,rgba(255,255,255,0.06),transparent_32%),radial-gradient(circle_at_82%_28%,rgba(99,102,241,0.07),transparent_34%),linear-gradient(180deg,#02050b_0%,#04060c_54%,#06080d_100%)]" />
    <div className="grid-lines-bg absolute inset-0 -z-10 opacity-[0.08]" />
    <div className="absolute top-20 left-1/2 -z-10 h-80 w-6xl -translate-x-1/2 rounded-full bg-sky-300/6 blur-[120px]" />

    <div className="mx-auto max-w-[1440px] px-5 pt-14 pb-14 md:px-8 md:pt-20 lg:px-10 lg:pb-20">
      <div className="mx-auto max-w-5xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
          </span>
          <span className="text-xs font-medium text-white/78">Enterprise MCP governance</span>
          <span className="h-3 w-px bg-white/14" />
          <span className="font-mono text-[11px] text-white/42">
            agents {'->'} business systems
          </span>
        </div>

        <h1 className="text-[clamp(2.8rem,5.6vw,5.35rem)] leading-[0.94] font-semibold tracking-[-0.065em] text-balance text-white">
          Mission Control
          <span className="block bg-linear-to-r from-white via-blue-100 to-blue-300 bg-clip-text pb-2 leading-[1.05] text-transparent">
            for AI agents.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-pretty text-white/72">
          <span className="block text-xl leading-8 font-medium text-white/85 md:text-2xl md:leading-9">
            The agents are working. The safety surface around them isn&apos;t.
          </span>
          <span className="mt-3 block text-base leading-7 text-white/58 md:text-lg">
            Shadow &rarr; enforce policy mode swap, audit on every call, saga rollback. The
            governance layer your AI agents reach business systems through.
          </span>
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,0.16)] hover:bg-white/90"
          >
            <Link href="#incidents">
              Why it matters
              <ArrowRightIcon className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-full border-white/14 bg-white/4.5 px-6 text-sm font-semibold text-white backdrop-blur-xl hover:bg-white/8 hover:text-white"
          >
            <Link href="/signup">Start free</Link>
          </Button>
        </div>
      </div>

      <div className="relative mt-8 md:mt-10">
        <div className="absolute inset-x-8 top-8 -z-10 h-24 rounded-full bg-white/14 blur-[90px]" />
        <HeroProofCallouts />
        <DashboardPreview />
      </div>
    </div>
  </section>
);
