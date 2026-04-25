const STATS = [
  { value: 'Any', label: 'MCP server' },
  { value: '12', label: 'built-in policies' },
  { value: 'Shadow', label: 'to enforce' },
  { value: 'Audit', label: '+ rollback' },
];

export const StatStrip = () => (
  <div className="border-y border-border bg-background">
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      <div className="grid grid-cols-1 overflow-hidden border-x border-border sm:grid-cols-2 lg:grid-cols-4">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="border-b border-r border-border px-8 py-10 last:border-b-0 sm:nth-last-[-n+2]:border-b-0 lg:border-b-0 lg:last:border-r-0"
        >
          <div className="text-4xl font-medium tracking-[-0.035em] tabular-nums text-foreground md:text-5xl lg:text-4xl xl:text-5xl">
            {s.value}
          </div>
          <div className="mt-2 text-[12px] uppercase tracking-widest text-foreground/45">
            {s.label}
          </div>
        </div>
      ))}
      </div>
    </div>
  </div>
);
