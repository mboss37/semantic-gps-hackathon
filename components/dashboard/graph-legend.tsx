'use client';

// Canonical 8 TRel edge types (docs/USER-STORIES.md §Relationships & Graph).
// Colors are also consumed by the React Flow edge styling in the graph page —
// keep the two in sync.

export const EDGE_STYLES: Record<string, { stroke: string; label: string; description: string }> = {
  produces_input_for: { stroke: '#34d399', label: 'produces_input_for', description: 'output of A feeds B as input' },
  requires_before: { stroke: '#f97316', label: 'requires_before', description: 'B cannot run until A succeeds' },
  suggests_after: { stroke: '#22d3ee', label: 'suggests_after', description: 'B commonly follows A (non-binding)' },
  mutually_exclusive: { stroke: '#ef4444', label: 'mutually_exclusive', description: 'A and B cannot coexist in a trace' },
  alternative_to: { stroke: '#a78bfa', label: 'alternative_to', description: 'B is an interchangeable substitute for A' },
  validates: { stroke: '#facc15', label: 'validates', description: 'B checks the output of A' },
  compensated_by: { stroke: '#a3a3a3', label: 'compensated_by', description: 'B rolls back A on downstream failure' },
  fallback_to: { stroke: '#60a5fa', label: 'fallback_to', description: 'route to B if A fails' },
};

// Non-canonical edge key, used only when a `compensated_by` edge is actively
// lit up by a rollback cascade in the viz (Sprint 8 WP-I.2). Not a relationship
// type — keep it out of the 8-type legend row.
export const ROLLBACK_HIGHLIGHT_STYLE = {
  stroke: '#f43f5e',
  label: 'rollback',
  description: 'compensated_by edge firing live from an execute_route rollback',
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
