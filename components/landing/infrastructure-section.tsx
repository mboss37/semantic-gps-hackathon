import { ArchitectureDiagram } from './architecture-diagram';

const STATS = [
  { value: 'MCP', label: 'discovers tools' },
  { value: 'TRel', label: 'discovers flows' },
  { value: 'Agents', label: 'follow safe paths' },
] as const;

export const InfrastructureSection = () => (
  <section id="architecture" className="relative overflow-hidden py-24 lg:py-32">
    <div className="absolute inset-x-0 top-1/2 -z-10 h-96 -translate-y-1/2 bg-blue-500/10 blur-[140px]" />
    <div className="mx-auto max-w-[1320px] px-5 md:px-8 lg:px-10">
      <div className="mb-12 grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-blue-100/55 uppercase">
            MCP extension
          </p>
          <h2 className="max-w-4xl text-4xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance text-white md:text-6xl">
            TRel is the MCP extension for workflow discovery.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">
            Tool Relationship (TRel) tells agents how MCP tools work together: valid execution
            flows, fallback options, and rollback paths when a multi-step action fails.
          </p>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.045] backdrop-blur-xl">
          {STATS.map((stat) => (
            <div key={stat.label} className="border-r border-white/10 p-4 last:border-r-0">
              <div className="text-2xl font-semibold tracking-[-0.04em] text-white">
                {stat.value}
              </div>
              <div className="mt-1 text-[11px] leading-tight text-white/42">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2.25rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:p-5">
        <div className="mb-4 flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-black/22 px-4 py-3">
          <span className="font-mono text-[10px] tracking-[0.22em] text-white/42 uppercase">
            tool relationship boundary
          </span>
          <span className="rounded-full border border-blue-200/20 bg-blue-300/10 px-2.5 py-1 font-mono text-[10px] text-blue-100">
            discover / fallback / rollback
          </span>
        </div>
        <ArchitectureDiagram />
      </div>
    </div>
  </section>
);
