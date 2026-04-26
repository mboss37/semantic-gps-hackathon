import { ActivityIcon, ClipboardCheckIcon, GitBranchIcon, ShieldCheckIcon } from 'lucide-react';

type Feature = {
  title: string;
  lede: string;
  metric: string;
  eyebrow: string;
  visual: 'trel' | 'policy' | 'governance' | 'playground';
};

const FEATURES: readonly Feature[] = [
  {
    eyebrow: 'Unique MCP extension',
    title: 'Give agents a map of safe tool flows.',
    lede: 'MCP tells agents what tools exist. TRel shows which tools are safe to chain, validate, fall back, and roll back.',
    metric: 'TRel',
    visual: 'trel',
  },
  {
    eyebrow: 'Policy Management',
    title: 'Define the rules agents must follow.',
    lede: 'Apply out-of-the-box policies for identity, PII, rate limits, time windows, residency, and kill switches without redeploying agents.',
    metric: 'ready rules',
    visual: 'policy',
  },
  {
    eyebrow: 'Governance',
    title: 'See every agent action.',
    lede: 'Track who called what, which policy decided, what failed, and how agent traffic changes across audit and monitoring views.',
    metric: 'live ops',
    visual: 'governance',
  },
  {
    eyebrow: 'Playground',
    title: 'Prove governance before shipping.',
    lede: 'Compare raw and governed execution so teams can see exactly what Semantic GPS changes before production rollout.',
    metric: 'A/B validate',
    visual: 'playground',
  },
];

const ICONS = {
  trel: GitBranchIcon,
  policy: ShieldCheckIcon,
  governance: ActivityIcon,
  playground: ClipboardCheckIcon,
} as const;

const POLICY_ROWS = [
  ['Sensitive data', 'watch'],
  ['Verified agent', 'allow'],
  ['After-hours write', 'block'],
] as const;

const PolicyConsole = () => (
  <div className="space-y-3">
    {POLICY_ROWS.map(([label, mode], index) => (
      <div
        key={label}
        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5.5 px-3 py-3"
      >
        <span className="font-mono text-[11px] text-white/72">{label}</span>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
            index === 2
              ? 'border-red-300/25 bg-red-300/10 text-red-100'
              : index === 0
                ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
          }`}
        >
          {mode}
        </span>
      </div>
    ))}
  </div>
);

const TrelConsole = () => (
  <svg viewBox="0 0 420 220" className="h-full min-h-[220px] w-full">
    <defs>
      <linearGradient id="feature-route" x1="0" x2="1">
        <stop stopColor="rgb(56 189 248)" stopOpacity="0.1" />
        <stop offset="0.5" stopColor="rgb(96 165 250)" stopOpacity="0.9" />
        <stop offset="1" stopColor="rgb(168 85 247)" stopOpacity="0.15" />
      </linearGradient>
    </defs>
    {[
      ['M68 110 C132 58 194 76 214 112'],
      ['M214 112 C255 62 313 66 360 96'],
      ['M214 112 C266 164 320 158 360 132'],
    ].map(([d]) => (
      <path key={d} d={d} fill="none" stroke="url(#feature-route)" strokeWidth="1.4" />
    ))}
    {[
      [68, 110, 'agent'],
      [214, 112, 'TRel'],
      [360, 96, 'CRM'],
      [360, 132, 'Slack'],
    ].map(([x, y, label]) => (
      <g key={label}>
        <rect
          x={Number(x) - 42}
          y={Number(y) - 20}
          width="84"
          height="40"
          rx="14"
          fill="rgb(255 255 255 / 0.07)"
          stroke="rgb(255 255 255 / 0.16)"
        />
        <text
          x={Number(x)}
          y={Number(y) + 4}
          textAnchor="middle"
          className="fill-white/80 text-[11px]"
        >
          {label}
        </text>
      </g>
    ))}
  </svg>
);

const PlaygroundConsole = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2">
      {['Raw agent', 'Governed'].map((step, index) => (
        <div
          key={step}
          className={`rounded-2xl border p-4 text-center font-mono text-[11px] ${
            index === 1
              ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
              : 'border-white/10 bg-white/5 text-white/62'
          }`}
        >
          {step}
        </div>
      ))}
    </div>
    <div className="rounded-3xl border border-blue-200/20 bg-blue-300/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.2em] text-blue-100/70 uppercase">
          validation run
        </span>
        <span className="rounded-full border border-blue-200/20 px-2 py-0.5 font-mono text-[10px] text-blue-100">
          ready
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-4/5 rounded-full bg-linear-to-r from-sky-300 to-blue-500" />
      </div>
    </div>
  </div>
);

const GovernanceConsole = () => (
  <div className="space-y-3">
    {[
      ['Audit event', 'allowed', '184ms'],
      ['Policy block', 'blocked', '91ms'],
      ['Traffic spike', 'watched', '7d'],
    ].map(([method, status, latency]) => (
      <div
        key={`${method}-${latency}`}
        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/4.5 px-3 py-2.5"
      >
        <span className="font-mono text-[11px] text-white/70">{method}</span>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 font-mono text-[10px] text-emerald-100">
          {status}
        </span>
        <span className="font-mono text-[10px] text-white/35">{latency}</span>
      </div>
    ))}
  </div>
);

const ConsoleVisual = ({ type }: { type: Feature['visual'] }) => {
  if (type === 'trel') return <TrelConsole />;
  if (type === 'policy') return <PolicyConsole />;
  if (type === 'governance') return <GovernanceConsole />;
  return <PlaygroundConsole />;
};

const FeatureCard = ({ feature }: { feature: Feature }) => {
  const Icon = ICONS[feature.visual];
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:border-white/24 hover:bg-white/[0.035]">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/28 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-white">
            <Icon className="size-5" />
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">
            {feature.metric}
          </span>
        </div>
        <p className="font-mono text-[10px] tracking-[0.22em] text-white/42 uppercase">
          {feature.eyebrow}
        </p>
        <h3 className="mt-3 text-2xl leading-tight font-semibold tracking-[-0.035em] text-white">
          {feature.title}
        </h3>
        <p className="mt-3 min-h-[96px] text-sm leading-6 text-white/52">{feature.lede}</p>
        <div className="mt-7 min-h-[220px] rounded-3xl border border-white/10 bg-black/40 p-4">
          <ConsoleVisual type={feature.visual} />
        </div>
      </div>
    </article>
  );
};

export const FeaturesSection = () => (
  <section id="features" className="relative overflow-hidden py-24 lg:py-32">
    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/16 to-transparent" />
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="mb-12 max-w-3xl">
        <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
          Main features
        </p>
        <h2 className="text-4xl leading-[1.02] font-semibold tracking-tighter text-balance text-white md:text-6xl">
          Govern agents before they touch production.
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">
          Semantic GPS gives AI platform and security teams one gateway for policies, audit,
          logging, monitoring, and Tool Relationship definitions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </div>
    </div>
  </section>
);
