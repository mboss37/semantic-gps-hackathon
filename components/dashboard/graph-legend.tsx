'use client';

// 8 TRel edge types. Colors are also consumed by the React Flow edge styling
// in the graph page — keep the two in sync.

export const EDGE_STYLES: Record<string, { stroke: string; label: string; description: string }> = {
  depends_on: { stroke: '#f97316', label: 'depends_on', description: 'requires the target first' },
  composes_into: { stroke: '#22d3ee', label: 'composes_into', description: 'step within the target flow' },
  alternative_to: { stroke: '#a78bfa', label: 'alternative_to', description: 'interchangeable alternative' },
  prerequisite: { stroke: '#facc15', label: 'prerequisite', description: 'gating precondition' },
  conflicts_with: { stroke: '#ef4444', label: 'conflicts_with', description: 'cannot run together' },
  enables: { stroke: '#34d399', label: 'enables', description: 'unlocks the target' },
  requires_auth: { stroke: '#60a5fa', label: 'requires_auth', description: 'target needs the subject for auth' },
  deprecated_by: { stroke: '#a3a3a3', label: 'deprecated_by', description: 'superseded' },
};

export const GraphLegend = () => (
  <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
    {Object.entries(EDGE_STYLES).map(([key, s]) => (
      <div key={key} className="flex items-center gap-1.5 rounded bg-zinc-950 px-2 py-1" title={s.description}>
        <span className="h-0.5 w-5" style={{ backgroundColor: s.stroke }} />
        <span className="text-zinc-300">{s.label}</span>
      </div>
    ))}
  </div>
);
