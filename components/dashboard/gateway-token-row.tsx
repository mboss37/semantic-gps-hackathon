'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TableCell, TableRow } from '@/components/ui/table';

// Sprint 7 WP-A.6: one row per token. We only ever display name + timestamps
// — the plaintext / hash never leave the server. `last_used_at` is humanized
// relative to "now" since raw ISO strings are hostile at a glance on a
// reconcile-the-clients screen.

type Props = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const humanizeRelative = (iso: string | null): string => {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const delta = Date.now() - then;
  if (delta < 0) return 'just now';
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) {
    const m = Math.floor(delta / MINUTE);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (delta < DAY) {
    const h = Math.floor(delta / HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  const d = Math.floor(delta / DAY);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toISOString().slice(0, 10);
};

const formatCreated = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
};

export const GatewayTokenRow = ({ id, name, lastUsedAt, createdAt }: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/gateway-tokens/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }
      toast.success('Token revoked');
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{name}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {humanizeRelative(lastUsedAt)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{formatCreated(createdAt)}</TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            title="Revoke token"
            className="text-red-400 hover:text-red-300"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </TableCell>
      </TableRow>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke token?</DialogTitle>
            <DialogDescription>
              Any MCP client using <span className="text-foreground">{name}</span> will start
              getting 401 on the next call. This cannot be undone — mint a new token if you need
              to restore access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => void onDelete()}>
              {pending ? 'Revoking…' : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
