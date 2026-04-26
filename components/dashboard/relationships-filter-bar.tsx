'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EDGE_STYLES } from '@/components/dashboard/graph-legend';

// Sprint 27: filter strip on the relationships page. URL state via
// useSearchParams, reload preserves filters and the recent activity row's
// "View audit trail" pattern works the same way here for share-by-link.

type ServerOption = {
  id: string;
  name: string;
};

type Props = {
  servers: ServerOption[];
  totalEdges: number;
  filteredEdges: number;
};

const ALL = '__all__';

export const RelationshipsFilterBar = ({ servers, totalEdges, filteredEdges }: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialType = searchParams.get('type') ?? ALL;
  const initialServer = searchParams.get('server') ?? ALL;
  const initialQ = searchParams.get('q') ?? '';

  const [type, setType] = useState(initialType);
  const [server, setServer] = useState(initialServer);
  const [q, setQ] = useState(initialQ);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (type !== ALL) p.set('type', type);
    if (server !== ALL) p.set('server', server);
    if (q.trim().length > 0) p.set('q', q.trim());
    return p.toString();
  }, [type, server, q]);

  useEffect(() => {
    const next = params.length > 0 ? `?${params}` : '';
    const current = searchParams.toString();
    if (next === (current.length > 0 ? `?${current}` : '')) return;
    router.replace(`/dashboard/relationships${next}`);
  }, [params, router, searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1 max-w-md">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tool or description…"
          className="pl-8 font-mono text-xs"
        />
      </div>

      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-[200px] text-xs">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {Object.entries(EDGE_STYLES).map(([key, s]) => (
            <SelectItem key={key} value={key} className="font-mono text-xs">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.stroke }} />
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={server} onValueChange={setServer}>
        <SelectTrigger className="w-[200px] text-xs">
          <SelectValue placeholder="All servers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All servers</SelectItem>
          {servers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
        {filteredEdges === totalEdges ? (
          <>{totalEdges} edge{totalEdges === 1 ? '' : 's'}</>
        ) : (
          <>
            {filteredEdges} <span className="opacity-60">/ {totalEdges}</span>
          </>
        )}
      </span>
    </div>
  );
};
