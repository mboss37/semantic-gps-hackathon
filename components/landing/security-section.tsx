import { FileCheckIcon, LifeBuoyIcon, ShieldIcon, ToggleRightIcon } from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldIcon,
    title: 'Audit every governed call',
    description:
      'Capture the tool, policy decision, status, latency, and result for every action through the gateway.',
  },
  {
    icon: ToggleRightIcon,
    title: 'Monitor live operations',
    description:
      'Track traffic, errors, blocked calls, and policy decisions from the same dashboard.',
  },
  {
    icon: FileCheckIcon,
    title: 'Validate in Playground',
    description:
      'Compare raw agent behavior against the governed gateway path before promoting a workflow.',
  },
  {
    icon: LifeBuoyIcon,
    title: 'Enforce from policy state',
    description:
      'Switch policies from observation to enforcement without redeploying agents or changing tools.',
  },
] as const;

const DIMENSIONS = [
  'Hygiene',
  'Identity',
  'Rate',
  'Time',
  'Residency',
  'Kill-switch',
  'Idempotency',
] as const;

export const SecuritySection = () => (
  <section id="governance" className="relative overflow-hidden py-24 lg:py-32">
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
            Governance
          </p>
          <h2 className="text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance text-white md:text-6xl">
            Governance with audit, monitoring, and validation.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/55">
            Operators get a Vercel-style operational surface for agent workflows: clear state,
            searchable records, traffic health, and validation before production.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {DIMENSIONS.map((dim) => (
              <span
                key={dim}
                className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 font-mono text-[10px] text-white/48 backdrop-blur"
              >
                {dim}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue-200/32 to-transparent" />
                <div className="mb-5 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-blue-100">
                  <Icon className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-[-0.025em] text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-6 text-white/52">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);
