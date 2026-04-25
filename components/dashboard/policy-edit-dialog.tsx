'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PolicyConfigForm } from '@/components/dashboard/policy-config-forms';
import { PolicyEditAssignments } from '@/components/dashboard/policy-edit-assignments';

// Sprint 28 IA flip: edit modal mirrors `policy-create-dialog.tsx` field for
// field, MINUS the builtin picker (locked to the existing instance) PLUS a
// destructive Delete + an `<PolicyEditAssignments>` block. Initial state is
// seeded from props on mount; parents must remount via `key={instance.id}`
// to switch between instances (no useEffect needed).

type Mode = 'shadow' | 'enforce';

type Assignment = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

type ServerOption = { id: string; name: string };

type ToolOption = {
  id: string;
  name: string;
  server_id: string;
  server_name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  policy: {
    id: string;
    name: string;
    builtin_key: string;
    config: Record<string, unknown>;
    enforcement_mode: Mode;
  };
  assignments: Assignment[];
  servers: ServerOption[];
  tools: ToolOption[];
};

export const PolicyEditDialog = ({
  open,
  onOpenChange,
  policy,
  assignments,
  servers,
  tools,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(policy.name);
  const [config, setConfig] = useState<Record<string, unknown>>(policy.config);
  const [mode, setMode] = useState<Mode>(policy.enforcement_mode);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSave = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || policy.name,
          config,
          enforcement_mode: mode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Policy saved');
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setPending(false);
    }
  };

  const onDelete = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${policy.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Policy deleted');
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error('Delete failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit policy</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{policy.builtin_key}</span> · adjust the config, mode, or
            attachments. Changes apply on the next gateway invocation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="policy-edit-name">Name</Label>
            <Input
              id="policy-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="grid gap-2">
            <Label>Config</Label>
            <PolicyConfigForm
              builtinKey={policy.builtin_key}
              config={config}
              onChange={setConfig}
            />
          </div>

          <div className="grid gap-2">
            <Label>Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => v && setMode(v as Mode)}
              disabled={pending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shadow">shadow (log only)</SelectItem>
                <SelectItem value="enforce">enforce (block or redact)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PolicyEditAssignments
            policyId={policy.id}
            assignments={assignments}
            servers={servers}
            tools={tools}
            disabled={pending}
          />
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">Delete this policy?</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => void onDelete()}
              >
                {pending ? 'Deleting…' : 'Confirm delete'}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon className="size-3.5" />
              Delete policy
            </Button>
          )}
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={() => void onSave()} disabled={pending}>
              {pending ? 'Saving…' : 'Save policy'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
