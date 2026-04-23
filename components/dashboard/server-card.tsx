'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRightIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

const CHIP_LIMIT = 12;

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

  const shouldTruncate = tools.length > CHIP_LIMIT && !expanded;
  const visible = shouldTruncate ? tools.slice(0, CHIP_LIMIT) : tools;
  const hiddenCount = tools.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            {originUrl && (
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {originUrl}
              </p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0">{transport}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Tools · {tools.length}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        </div>
        {tools.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tools discovered — origin may be unreachable.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((t) => (
              <Tooltip key={t.name}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="font-mono text-[11px] font-normal"
                  >
                    {t.name}
                  </Badge>
                </TooltipTrigger>
                {t.description && (
                  <TooltipContent side="bottom" className="max-w-xs">
                    {t.description}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
            {hiddenCount > 0 && (
              <Badge
                variant="outline"
                className="cursor-pointer text-[11px] font-normal"
                onClick={() => setExpanded(true)}
              >
                +{hiddenCount} more
              </Badge>
            )}
            {expanded && tools.length > CHIP_LIMIT && (
              <Badge
                variant="outline"
                className="cursor-pointer text-[11px] font-normal"
                onClick={() => setExpanded(false)}
              >
                Collapse
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-4" />
          Delete
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href={`/dashboard/servers/${id}`}>
            View details
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
