// Market-fear stat strip. Replaces the legacy product-feature counts.
// These four numbers anchor the urgency that the hero subhead opens with
// (Gravitee 2026 + Grant Thornton 2026 + EU AI Act). Sourced inline in
// docs/VISION.md § References. Keep tabular-nums on the values so the
// 97% / 88% / 14% line up cleanly across the strip.

const STATS = [
  {
    value: '97%',
    label: 'Expect incident',
    detail: 'of enterprises expect a major AI agent security incident in the next 12 months',
  },
  {
    value: '88%',
    label: 'Already had one',
    detail: 'reported a confirmed or suspected AI agent security incident this year',
  },
  {
    value: '14%',
    label: 'With full review',
    detail: 'of agents reach production with full security or IT approval',
  },
  {
    value: 'Aug 2 2026',
    label: 'EU AI Act',
    detail: 'high-risk AI systems must comply or stop operating',
  },
];

export const StatStrip = () => (
  <section className="relative z-10 -mt-8 px-5 md:px-8 lg:px-10">
    <div className="mx-auto max-w-[1240px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="relative overflow-hidden px-6 py-7 md:px-8">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/24 to-transparent" />
            <div className="text-4xl font-semibold tracking-[-0.055em] text-white tabular-nums md:text-5xl lg:text-4xl xl:text-5xl">
              {s.value}
            </div>
            <div className="mt-2 font-mono text-[11px] tracking-[0.18em] text-red-100/65 uppercase">
              {s.label}
            </div>
            <p className="mt-3 text-sm leading-6 text-white/52">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
