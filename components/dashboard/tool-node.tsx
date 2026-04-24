'use client';

import { Handle, Position } from '@xyflow/react';

type ToolNodeData = {
  name: string;
  description?: string | null;
};

export const ToolNode = ({ data, selected }: { data: ToolNodeData; selected?: boolean }) => (
  <div
    className={`rounded-md border px-3 py-2 text-xs shadow-sm ${
      selected
        ? 'border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_10%,transparent)]'
        : 'border-border bg-card'
    }`}
  >
    <Handle type="target" position={Position.Top} style={{ background: '#52525b' }} />
    <p className="font-medium text-zinc-100">{data.name}</p>
    {data.description && (
      <p className="mt-0.5 max-w-[180px] truncate text-zinc-400">{data.description}</p>
    )}
    <Handle type="source" position={Position.Bottom} style={{ background: '#52525b' }} />
  </div>
);
