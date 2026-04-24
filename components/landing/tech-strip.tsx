// Footer "Built on" tech strip. Text wordmarks only — no external logo
// sourcing, no PNGs. Each entry is a light-weight text wordmark with a small
// inline dot so the row reads as a strip, not a list.

const STACK = [
  'Next.js',
  'TypeScript',
  'Supabase',
  'MCP',
  'Anthropic',
  'Vercel',
  'Tailwind',
];

export const TechStrip = () => (
  <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pb-10">
    <span className="text-xs text-muted-foreground/70 uppercase tracking-widest font-medium mr-2">
      Built on
    </span>
    {STACK.map((tech, i) => (
      <div key={tech} className="flex items-center gap-3">
        {i > 0 && <span className="size-1 rounded-full bg-muted-foreground/30" aria-hidden />}
        <span className="text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors cursor-default">
          {tech}
        </span>
      </div>
    ))}
  </div>
);
