'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { EDGE_STYLES } from '@/components/dashboard/graph-legend';

// Sprint 6 WP-G.2: one row per relationship. Inline edit on double-click of
// the description cell; Enter saves, Esc cancels. Delete goes through a
// confirm dialog so a stray click doesn't torch a relationship.

type Props = {
  id: string;
  fromToolName: string | null;
  toToolName: string | null;
  relationshipType: string;
  description: string;
};

export const RelationshipRow = ({
  id,
  fromToolName,
  toToolName,
  relationshipType,
  description,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = EDGE_STYLES[relationshipType];

  const startEdit = () => {
    setDraft(description);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setDraft(description);
    setEditing(false);
  };

  const saveEdit = async () => {
    const next = draft.trim();
    if (next === description) {
      setEditing(false);
      return;
    }
    if (next.length < 5) {
      toast.error('Description must be at least 5 characters');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/relationships/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Description updated');
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  const onDelete = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/relationships/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Relationship deleted');
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">{fromToolName ?? '—'}</TableCell>
        <TableCell>
          <Badge
            variant="outline"
            style={{ borderColor: style?.stroke, color: style?.stroke }}
          >
            {relationshipType}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-xs">{toToolName ?? '—'}</TableCell>
        <TableCell
          className="max-w-md text-sm"
          onDoubleClick={startEdit}
          title="Double-click to edit"
        >
          {editing ? (
            <Textarea
              ref={textareaRef}
              rows={2}
              value={draft}
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void saveEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              className="text-sm"
            />
          ) : (
            <span className="block whitespace-normal text-foreground">{description}</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              disabled={pending || editing}
              title="Edit description"
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              title="Delete relationship"
              className="text-red-400 hover:text-red-300"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete relationship?</DialogTitle>
            <DialogDescription>
              {fromToolName ?? '?'} → {toToolName ?? '?'} ({relationshipType})
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => void onDelete()}>
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
