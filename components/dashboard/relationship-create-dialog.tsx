'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PlusIcon } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EDGE_STYLES } from '@/components/dashboard/graph-legend';

// Sprint 6 WP-G.2: client-side wizard for POSTing a new relationship. Tools
// are grouped by server name in the Select so the user can find the right
// endpoint at a glance. Validation mirrors the server-side zod:
//   - description >= 5 chars
//   - from_tool_id !== to_tool_id
// Everything else surfaces from the API's typed 400/403/409 responses.

type ToolOption = {
  id: string;
  name: string;
  server_id: string;
  server_name: string;
};

type Props = {
  tools: ToolOption[];
  defaultFromToolId?: string;
  trigger?: React.ReactNode;
  onCreated?: () => void;
};

const RELATIONSHIP_TYPES = Object.keys(EDGE_STYLES);

export const RelationshipCreateDialog = ({
  tools,
  defaultFromToolId,
  trigger,
  onCreated,
}: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fromId, setFromId] = useState<string | undefined>(defaultFromToolId);
  const [toId, setToId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<string>('produces_input_for');
  const [description, setDescription] = useState('');

  const grouped = useMemo(() => {
    const byServer = new Map<string, ToolOption[]>();
    for (const t of tools) {
      const bucket = byServer.get(t.server_name) ?? [];
      bucket.push(t);
      byServer.set(t.server_name, bucket);
    }
    return Array.from(byServer.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);

  const reset = () => {
    setFromId(defaultFromToolId);
    setToId(undefined);
    setType('produces_input_for');
    setDescription('');
  };

  const onSubmit = async () => {
    if (!fromId || !toId) {
      toast.error('Pick both from and to tools');
      return;
    }
    if (fromId === toId) {
      toast.error('A relationship must connect two different tools');
      return;
    }
    if (description.trim().length < 5) {
      toast.error('Description must be at least 5 characters');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          from_tool_id: fromId,
          to_tool_id: toId,
          relationship_type: type,
          description: description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason =
          res.status === 409
            ? 'Relationship already exists'
            : res.status === 403
              ? 'Cross-org tool ids rejected'
              : (data?.error ?? `HTTP ${res.status}`);
        throw new Error(reason);
      }
      toast.success('Relationship created');
      reset();
      setOpen(false);
      onCreated?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <PlusIcon className="size-4" />
      New relationship
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create relationship</DialogTitle>
          <DialogDescription>
            TRel edges drive workflow suggestions, fallbacks, and validation in the gateway.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>From tool</Label>
            <Select
              value={fromId ?? ''}
              onValueChange={(v) => setFromId(v || undefined)}
              disabled={tools.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={tools.length === 0 ? 'No tools yet' : 'Pick source tool'} />
              </SelectTrigger>
              <SelectContent>
                {grouped.map(([server, toolsInServer]) => (
                  <SelectGroup key={server}>
                    <SelectLabel>{server}</SelectLabel>
                    {toolsInServer.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>To tool</Label>
            <Select
              value={toId ?? ''}
              onValueChange={(v) => setToId(v || undefined)}
              disabled={tools.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick target tool" />
              </SelectTrigger>
              <SelectContent>
                {grouped.map(([server, toolsInServer]) => (
                  <SelectGroup key={server}>
                    <SelectLabel>{server}</SelectLabel>
                    {toolsInServer.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Relationship type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((key) => {
                  const style = EDGE_STYLES[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-0.5 w-4"
                          style={{ backgroundColor: style.stroke }}
                        />
                        {key}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {EDGE_STYLES[type]?.description ?? ''}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rel-description">Description</Label>
            <Textarea
              id="rel-description"
              rows={3}
              placeholder="Explain how A connects to B so the planner (and your teammates) understand the edge."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Creating…' : 'Create relationship'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
