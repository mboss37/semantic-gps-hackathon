'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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

// Sprint 28: extracted from `policy-edit-dialog.tsx` so the dialog stays
// under the 400-line ceiling. Owns the attach-server / attach-tool /
// detach round-trips for one specific policy_id; pure UI when there are
// no assignments.

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
  policyId: string;
  assignments: Assignment[];
  servers: ServerOption[];
  tools: ToolOption[];
  disabled: boolean;
};

export const PolicyEditAssignments = ({
  policyId,
  assignments,
  servers,
  tools,
  disabled,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [attachServerId, setAttachServerId] = useState<string | undefined>(undefined);
  const [attachToolId, setAttachToolId] = useState<string | undefined>(undefined);

  const serversById = new Map(servers.map((s) => [s.id, s.name]));
  const toolsById = new Map(tools.map((t) => [t.id, t]));

  const groupedTools = (() => {
    const byServer = new Map<string, ToolOption[]>();
    for (const t of tools) {
      const bucket = byServer.get(t.server_name) ?? [];
      bucket.push(t);
      byServer.set(t.server_name, bucket);
    }
    return Array.from(byServer.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  const labelForAssignment = (a: Assignment): string => {
    if (a.tool_id) {
      const tool = toolsById.get(a.tool_id);
      if (tool) return `tool · ${tool.server_name} / ${tool.name}`;
      return `tool · ${a.tool_id.slice(0, 8)}…`;
    }
    if (a.server_id) {
      return `server · ${serversById.get(a.server_id) ?? a.server_id.slice(0, 8)}`;
    }
    return 'org-wide';
  };

  const onAttachServer = async () => {
    if (!attachServerId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ server_id: attachServerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Attached to server');
      setAttachServerId(undefined);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Attach failed');
    } finally {
      setPending(false);
    }
  };

  const onAttachTool = async () => {
    if (!attachToolId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool_id: attachToolId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const reason =
          res.status === 403 ? 'Cross-org tool rejected' : (data?.error ?? `HTTP ${res.status}`);
        throw new Error(reason);
      }
      toast.success('Attached to tool');
      setAttachToolId(undefined);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Attach failed');
    } finally {
      setPending(false);
    }
  };

  const onDetach = async (assignmentId: string) => {
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Detached');
      router.refresh();
    } catch {
      toast.error('Detach failed');
    } finally {
      setPending(false);
    }
  };

  const blocked = disabled || pending;

  return (
    <div className="grid gap-2">
      <Label>Assignments</Label>
      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Not attached, policy is dormant. Attach to a server or tool below.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5 text-xs"
            >
              <span className="font-mono text-foreground/90">{labelForAssignment(a)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-muted-foreground hover:text-destructive"
                disabled={blocked}
                onClick={() => onDetach(a.id)}
              >
                <XIcon className="size-3.5" />
                Detach
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Attach to server</Label>
          <Select
            value={attachServerId ?? ''}
            onValueChange={(v) => setAttachServerId(v ? v : undefined)}
            disabled={blocked || servers.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={servers.length === 0 ? 'No servers yet' : 'Pick a server'}
              />
            </SelectTrigger>
            <SelectContent>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          disabled={blocked || !attachServerId}
          onClick={() => void onAttachServer()}
        >
          Attach
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Attach to tool</Label>
          <Select
            value={attachToolId ?? ''}
            onValueChange={(v) => setAttachToolId(v ? v : undefined)}
            disabled={blocked || tools.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={tools.length === 0 ? 'No tools yet' : 'Pick a tool'} />
            </SelectTrigger>
            <SelectContent>
              {groupedTools.map(([server, toolsInServer]) => (
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
        <Button size="sm" disabled={blocked || !attachToolId} onClick={() => void onAttachTool()}>
          Attach
        </Button>
      </div>
    </div>
  );
};
