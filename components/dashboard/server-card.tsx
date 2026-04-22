'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

type Props = {
  id: string;
  name: string;
  transport: string;
  originUrl: string | null;
  createdAt: string;
  toolCount: number;
};

export const ServerCard = ({ id, name, transport, originUrl, createdAt, toolCount }: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

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
      <CardContent>
        {originUrl ? (
          <p className="truncate text-xs text-muted-foreground">{originUrl}</p>
        ) : (
          <p className="text-xs text-muted-foreground">inline spec import</p>
        )}
        <p className="mt-3 text-sm">
          {toolCount} tool{toolCount === 1 ? '' : 's'}
        </p>
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
