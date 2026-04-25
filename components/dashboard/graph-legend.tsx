'use client';

import {
  ArrowRightIcon,
  BanIcon,
  GitForkIcon,
  LightbulbIcon,
  Link2Icon,
  ShieldCheckIcon,
  ShuffleIcon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react';

// Canonical 8 TRel edge types (docs/USER-STORIES.md §Relationships & Graph).
// Colors are also consumed by the React Flow edge styling in the graph page —
// keep the two in sync. Sprint 27: each type has a Lucide icon + a short
// label so the relationships row renders a single colored icon-with-caption
// per edge — no unicode connector strings (which rendered with inconsistent
// weight/centering across types).

export type EdgeStyle = {
  stroke: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export const EDGE_STYLES: Record<string, EdgeStyle> = {
  produces_input_for: {
    stroke: '#34d399',
    label: 'produces_input_for',
    shortLabel: 'produces',
    description: 'output of A feeds B as input',
    icon: ArrowRightIcon,
  },
  requires_before: {
    stroke: '#f97316',
    label: 'requires_before',
    shortLabel: 'requires',
    description: 'B cannot run until A succeeds',
    icon: Link2Icon,
  },
  suggests_after: {
    stroke: '#22d3ee',
    label: 'suggests_after',
    shortLabel: 'suggests',
    description: 'B commonly follows A (non-binding)',
    icon: LightbulbIcon,
  },
  mutually_exclusive: {
    stroke: '#ef4444',
    label: 'mutually_exclusive',
    shortLabel: 'excludes',
    description: 'A and B cannot coexist in a trace',
    icon: BanIcon,
  },
  alternative_to: {
    stroke: '#a78bfa',
    label: 'alternative_to',
    shortLabel: 'alternative',
    description: 'B is an interchangeable substitute for A',
    icon: ShuffleIcon,
  },
  validates: {
    stroke: '#facc15',
    label: 'validates',
    shortLabel: 'validates',
    description: 'B checks the output of A',
    icon: ShieldCheckIcon,
  },
  compensated_by: {
    stroke: '#a3a3a3',
    label: 'compensated_by',
    shortLabel: 'rollback',
    description: 'B rolls back A on downstream failure',
    icon: Undo2Icon,
  },
  fallback_to: {
    stroke: '#60a5fa',
    label: 'fallback_to',
    shortLabel: 'fallback',
    description: 'route to B if A fails',
    icon: GitForkIcon,
  },
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
