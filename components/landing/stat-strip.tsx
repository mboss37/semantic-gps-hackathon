// Sprint 21 WP-21.4: stat band between hero copy and the dashboard hero
// image. Quantifies the gateway in four numbers judges can take in at a
// glance — what's actually in the box.

const STATS = [
  { value: '12', label: 'gateway policies' },
  { value: '7', label: 'governance dimensions' },
  { value: '3', label: 'reference MCPs' },
  { value: '14', label: 'curated tools' },
];

export const StatStrip = () => (
  <div className="border-y border-border bg-card/30 backdrop-blur-sm">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
      {STATS.map((s) => (
        <div key={s.label} className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="text-3xl md:text-4xl font-medium tracking-tight tabular-nums">
            {s.value}
          </div>
          <div className="mt-1 text-xs text-foreground/55 uppercase tracking-wide">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  </div>
);
