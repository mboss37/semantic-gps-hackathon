const STATS = [
  {
    value: 'Gateway',
    label: 'agent to system',
    detail: 'Govern calls between agents and MCP-connected systems',
  },
  {
    value: 'TRel',
    label: 'Tool Relationship',
    detail: 'A new MCP extension for tool relationship mapping',
  },
  {
    value: 'Policy',
    label: 'management',
    detail: 'Turn ready-made rules on or off without redeploys',
  },
  {
    value: 'Audit',
    label: '+ monitoring',
    detail: 'Track decisions, traffic, errors, and blocked calls',
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
            <div className="mt-2 text-[11px] tracking-[0.18em] text-blue-100/55 uppercase">
              {s.label}
            </div>
            <p className="mt-3 text-sm leading-6 text-white/42">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
