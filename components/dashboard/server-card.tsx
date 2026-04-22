'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export type ToolSummary = {
  name: string;
  description: string | null;
};

type Props = {
  id: string;
  name: string;
  transport: string;
  originUrl: string | null;
  createdAt: string;
  tools: ToolSummary[];
};

const PREVIEW = 3;

export const ServerCard = ({ id, name, transport, originUrl, createdAt, tools }: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const onDelete = async () => {
    if (!confirm(`Delete server "${name}" and all its tools?`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Server deleted');
      router.refresh();
    } catch {
      toast.error('Delete failed');
    } finally {
      setPending(false);
    }
  };

  const visible = expanded ? tools : tools.slice(0, PREVIEW);
  const hiddenCount = tools.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              created {new Date(createdAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="outline">{transport}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {originUrl ? (
          <p className="truncate text-xs text-muted-foreground">{originUrl}</p>
        ) : (
          <p className="text-xs text-muted-foreground">inline spec import</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {tools.length} tool{tools.length === 1 ? '' : 's'}
          </p>
          {tools.length > PREVIEW && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
              {expanded ? 'Collapse' : `Show all ${tools.length}`}
            </Button>
          )}
        </div>
        {tools.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tools discovered. The origin may be unreachable or returned an empty list.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {visible.map((t) => (
              <li key={t.name} className="flex flex-col rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="font-mono text-xs">{t.name}</span>
                {t.description && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
                )}
              </li>
            ))}
            {!expanded && hiddenCount > 0 && (
              <li className="text-xs text-muted-foreground">+{hiddenCount} more…</li>
            )}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2Icon className="size-4" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
};
