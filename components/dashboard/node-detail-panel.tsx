'use client';

import { XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type NodeDetail = {
  id: string;
  name: string;
  description: string | null;
  server_id: string;
};

type Props = {
  detail: NodeDetail | null;
  onClose: () => void;
};

export const NodeDetailPanel = ({ detail, onClose }: Props) => {
  if (!detail) return null;
  return (
    <aside className="absolute right-4 top-4 z-10 w-80 rounded-lg border border-zinc-800 bg-zinc-950/95 p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{detail.name}</p>
          <p className="mt-0.5 text-xs text-zinc-500">tool {detail.id.slice(0, 8)}…</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </div>
      <Badge variant="outline" className="mt-2 border-zinc-700 text-zinc-400">
        server {detail.server_id.slice(0, 8)}…
      </Badge>
      <p className="mt-3 text-sm text-zinc-300">{detail.description ?? 'No description.'}</p>
    </aside>
  );
};
