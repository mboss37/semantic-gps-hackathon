import { Reveal } from '@/components/landing/reveal';

// Vercel-style pipe-separated 4-stat strip. Each stat: big tabular number +
// terse label. Copy traces to PO §5 + Content §2. Tabular-nums critical for
// optical alignment of "12", "8", "3·12", "327".

type Stat = { value: string; label: string; tooltip: string };

const STATS: Stat[] = [
  {
    value: '12',
    label: 'Built-in policies, 7 governance dimensions',
    tooltip: 'Time, rate, identity, residency, hygiene, idempotency, kill.',
  },
  {
    value: '8',
    label: 'Typed workflow relationships, not a flat list',
    tooltip: 'Including compensated by and fallback to.',
  },
  {
    value: '3 × 12',
    label: 'MCPs and tools running end-to-end',
    tooltip: 'Salesforce, Slack, GitHub, live over the internet.',
  },
  {
    value: '327',
    label: 'Tests green, zero failing',
    tooltip: 'Every PR gated on tsc, lint, vitest.',
  },
];

export const StatStrip = () => (
  <section className="border-y border-border bg-muted/30 backdrop-blur-sm">
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
        {STATS.map((stat, i) => (
          <Reveal key={stat.value} delay={i * 80}>
            <div
              className="flex flex-col items-center justify-center text-center px-6 py-4 md:py-0 gap-1"
              title={stat.tooltip}
            >
              <span className="text-4xl md:text-5xl font-semibold tabular-nums tracking-tight text-foreground">
                {stat.value}
              </span>
              <span className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide max-w-[220px] leading-tight">
                {stat.label}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);
