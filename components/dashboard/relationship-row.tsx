'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EDGE_STYLES } from '@/components/dashboard/graph-legend';
import { monogramFor, serverHex } from '@/lib/relationships/server-tint';

// Sprint 27 redesign: each row is a 3-block grid, From tool (with monogram
// chip + server slug), mid-row glyph + connector arrow, To tool. Description
// rides on row 2. Edit + Delete are inline always-visible icon buttons (the
// hover-revealed `⋯` menu was both hard to discover AND raced with Radix
// DropdownMenu focus restoration on edit-mode mount, causing the textarea
// to flash and disappear). Inline edit saves on Enter, cancels on Esc, no
// onBlur autosave (avoids the same race when focus lands inside the modal).

type ToolEndpoint = {
  toolName: string;
  serverId: string;
  serverName: string;
};

type Props = {
  id: string;
  from: ToolEndpoint | null;
  to: ToolEndpoint | null;
  relationshipType: string;
  description: string;
};

export const RelationshipRow = ({
  id,
  from,
  to,
  relationshipType,
  description,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftDesc, setDraftDesc] = useState(description);
  const [draftType, setDraftType] = useState(relationshipType);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = EDGE_STYLES[relationshipType];
  const Icon = style?.icon;

  const startEdit = () => {
    setDraftDesc(description);
    setDraftType(relationshipType);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setDraftDesc(description);
    setDraftType(relationshipType);
    setEditing(false);
  };

  const saveEdit = async () => {
    const nextDesc = draftDesc.trim();
    const descChanged = nextDesc !== description;
    const typeChanged = draftType !== relationshipType;

    if (!descChanged && !typeChanged) {
      setEditing(false);
      return;
    }
    if (descChanged && nextDesc.length < 5) {
      toast.error('Description must be at least 5 characters');
      return;
    }
    setPending(true);
    try {
      const body: Record<string, string> = {};
      if (descChanged) body.description = nextDesc;
      if (typeChanged) body.relationship_type = draftType;
      const res = await fetch(`/api/relationships/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Relationship updated');
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
      <div className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/30">
        {/* Top row: from-tool · mid-glyph + connector · to-tool · actions */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
          <ToolBlock endpoint={from} />

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex cursor-help flex-col items-center gap-0.5 px-3"
                style={{ color: style?.stroke }}
              >
                {Icon ? <Icon className="size-4" /> : null}
                <span className="font-mono text-[10px] uppercase tracking-wider">
                  {style?.shortLabel ?? '-'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <span className="font-mono">{style?.label}</span>
              {style?.description ? <> · {style.description}</> : null}
            </TooltipContent>
          </Tooltip>

          <ToolBlock endpoint={to} />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={startEdit}
              disabled={pending || editing}
              aria-label="Edit description"
            >
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              aria-label="Delete relationship"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Bottom row: edit form (type + description) or read-only description */}
        <div className="pl-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Relationship type
                </span>
                <Select value={draftType} onValueChange={setDraftType}>
                  <SelectTrigger className="w-[260px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EDGE_STYLES).map(([key, s]) => {
                      const ItemIcon = s.icon;
                      return (
                        <SelectItem key={key} value={key} className="text-xs">
                          <ItemIcon className="size-3.5" style={{ color: s.stroke }} />
                          <span className="font-mono">{s.label}</span>
                          <span className="text-muted-foreground">· {s.description}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Description
                </span>
                <Textarea
                  ref={textareaRef}
                  rows={2}
                  value={draftDesc}
                  disabled={pending}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void saveEdit();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">⌘↵ save · ⎋ cancel</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={pending}
                    className="font-mono uppercase tracking-wider hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={pending}
                    className="font-mono uppercase tracking-wider text-foreground hover:underline"
                  >
                    {pending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p
              className="cursor-text text-xs text-muted-foreground"
              onDoubleClick={startEdit}
              title="Double-click to edit"
            >
              {description}
            </p>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete relationship?</DialogTitle>
            <DialogDescription>
              {from?.toolName ?? '?'} → {to?.toolName ?? '?'} ({relationshipType})
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

type ToolBlockProps = {
  endpoint: ToolEndpoint | null;
};

const ToolBlock = ({ endpoint }: ToolBlockProps) => {
  if (!endpoint) {
    return (
      <span className="font-mono text-xs text-muted-foreground/70">tool deleted</span>
    );
  }
  const tint = serverHex(endpoint.serverId);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-medium"
            style={{
              backgroundColor: `${tint}1a`,
              borderColor: `${tint}4d`,
              color: tint,
            }}
            aria-label={endpoint.serverName}
          >
            {monogramFor(endpoint.serverName)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {endpoint.serverName}
        </TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-col leading-tight">
        <code className="truncate font-mono text-xs text-foreground/90">{endpoint.toolName}</code>
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {endpoint.serverName.toLowerCase()}
        </span>
      </div>
    </div>
  );
};
