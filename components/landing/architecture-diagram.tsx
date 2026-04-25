const AGENTS = ['Claude', 'Cursor', 'custom agents'] as const;
const GATEWAY = ['Tool manifest', 'Policy engine', 'Workflow validator', 'Audit + rollback'] as const;
const DATA_LAYER = ['Raw MCPs', 'OpenAPI services', 'internal systems'] as const;

const LayerCard = ({
  eyebrow,
  title,
  description,
  items,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: readonly string[];
  featured?: boolean;
}) => (
  <div
    className={`relative min-h-[360px] rounded-xl border p-5 md:p-6 ${
      featured
        ? 'border-(--brand)/50 bg-card/45 shadow-[0_0_0_1px_rgba(0,112,243,0.12)]'
        : 'border-border bg-card/25'
    }`}
  >
    <div className="mb-8">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-foreground/42">
        {eyebrow}
      </p>
      <h3 className="text-2xl font-medium tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-foreground/52">{description}</p>
    </div>

    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item}
          className="flex items-center justify-between rounded-lg border border-border bg-background/80 px-3 py-3"
        >
          <div className="flex items-center gap-2.5">
            <span className={`size-2 rounded-full ${featured ? 'bg-(--brand)' : 'bg-foreground/35'}`} />
            <span className="text-sm font-medium text-foreground/82">{item}</span>
          </div>
          <span className="font-mono text-[10px] text-foreground/30">0{index + 1}</span>
        </div>
      ))}
    </div>
  </div>
);

const Connector = ({ label }: { label: string }) => (
  <div className="hidden items-center justify-center xl:flex">
    <div className="relative flex w-full items-center">
      <span className="h-px flex-1 bg-border" />
      <span className="mx-3 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/45">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  </div>
);

export const ArchitectureDiagram = () => (
  <div className="space-y-6">
    <div className="grid gap-4 xl:grid-cols-[1fr_120px_1.15fr_120px_1fr]">
      <LayerCard
        eyebrow="01 agentic layer"
        title="Agents stay generic"
        description="No business-policy redeploy every time operators change a rule."
        items={AGENTS}
      />
      <Connector label="MCP call" />
      <LayerCard
        eyebrow="02 Semantic GPS"
        title="Gateway boundary"
        description="The shipped control point for route validation, policy decisions, audit, fallback, and rollback."
        items={GATEWAY}
        featured
      />
      <Connector label="governed call" />
      <LayerCard
        eyebrow="03 data access layer"
        title="Systems stay yours"
        description="Existing MCP and OpenAPI surfaces keep their own auth, network, and data boundary."
        items={DATA_LAYER}
      />
    </div>

    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
      {[
        ['shadow first', 'Observe violations without blocking traffic.'],
        ['enforce next', 'Block the next request when a policy is ready.'],
        ['trace always', 'Every decision lands in the audit log.'],
      ].map(([title, description]) => (
        <div key={title} className="bg-background p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-foreground/42">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/58">{description}</p>
        </div>
      ))}
    </div>
  </div>
);
