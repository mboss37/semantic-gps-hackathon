type Integration = {
  name: string;
  kind: string;
  status: 'mcp' | 'openapi';
  initial: string;
};

const INTEGRATIONS: readonly Integration[] = [
  {
    name: 'Internal MCPs',
    kind: 'Customer-hosted tools behind your firewall',
    status: 'mcp',
    initial: 'IN',
  },
  {
    name: 'Vendor MCPs',
    kind: 'Any compliant HTTP-Streamable server',
    status: 'mcp',
    initial: 'VD',
  },
  {
    name: 'OpenAPI services',
    kind: 'Import specs and expose them as MCP tools',
    status: 'openapi',
    initial: 'OA',
  },
  {
    name: 'Custom tools',
    kind: 'Register bespoke operations from the dashboard',
    status: 'mcp',
    initial: '+',
  },
  {
    name: 'Local or VPC apps',
    kind: 'Govern tools without moving data to a SaaS proxy',
    status: 'mcp',
    initial: 'VP',
  },
  {
    name: 'Sandbox endpoints',
    kind: 'Validate workflows before promoting to production',
    status: 'openapi',
    initial: 'SB',
  },
];

export const IntegrationsSection = () => (
  <section
    id="integrations"
    className="relative overflow-hidden border-y border-white/10 bg-white/[0.025] py-24 lg:py-32"
  >
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="mb-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
            Existing stack
          </p>
          <h2 className="text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance text-white md:text-6xl">
            Works with the MCP stack you already have.
          </h2>
        </div>
        <p className="max-w-2xl text-lg leading-8 text-white/55">
          Semantic GPS adds relationships, policies, governance, and validation in front of existing
          MCP servers, OpenAPI services, and internal tools.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl transition duration-300 hover:border-white/24"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/24 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative z-10">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                  <span className="font-mono text-[11px] font-medium tracking-wider text-white/70">
                    {integration.initial}
                  </span>
                </div>
                {integration.status === 'mcp' ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-100/70">
                    <span className="size-1.5 rounded-full bg-blue-300" />
                    MCP
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-white/40">OpenAPI</span>
                )}
              </div>
              <div className="mb-1 text-base font-semibold tracking-[-0.02em] text-white">
                {integration.name}
              </div>
              <div className="text-sm leading-6 text-white/52">{integration.kind}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
