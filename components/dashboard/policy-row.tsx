'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LineChartIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PolicyConfigForm } from '@/components/dashboard/policy-config-forms';

type Mode = 'shadow' | 'enforce';

type Assignment = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

type ToolOption = {
  id: string;
  name: string;
  server_id: string;
  server_name: string;
};

type Props = {
  id: string;
  name: string;
  builtinKey: string;
  config: Record<string, unknown>;
  mode: Mode;
  assignments: Assignment[];
  servers: Array<{ id: string; name: string }>;
  tools: ToolOption[];
};

export const PolicyRow = ({
  id,
  name,
  builtinKey,
  config,
  mode,
  assignments,
  servers,
  tools,
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [configState, setConfigState] = useState<Record<string, unknown>>(config);
  const [attachServerId, setAttachServerId] = useState<string | undefined>(undefined);
  const [attachToolId, setAttachToolId] = useState<string | undefined>(undefined);
  const serversById = new Map(servers.map((s) => [s.id, s.name]));
  const toolsById = useMemo(() => new Map(tools.map((t) => [t.id, t])), [tools]);

  // Group tools by server_name so the Attach-to-tool Select renders the same
  // "server → tool" layout used in relationship-create-dialog.tsx.
  const groupedTools = useMemo(() => {
    const byServer = new Map<string, ToolOption[]>();
    for (const t of tools) {
      const bucket = byServer.get(t.server_name) ?? [];
      bucket.push(t);
      byServer.set(t.server_name, bucket);
    }
    return Array.from(byServer.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tools]);

  const patch = async (patchBody: Record<string, unknown>, successMsg: string) => {
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success(successMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  };

  const onToggleMode = (next: Mode) => {
    if (next === mode) return;
    patch({ enforcement_mode: next }, `Mode → ${next}`);
  };

  const onSaveConfig = () => {
    patch({ config: configState }, 'Config saved');
  };

  const onDelete = async () => {
    if (!confirm(`Delete policy "${name}"?`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Policy deleted');
      router.refresh();
    } catch {
      toast.error('Delete failed');
    } finally {
      setPending(false);
    }
  };

  const onAttachServer = async () => {
    if (!attachServerId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/policies/${id}/assignments`, {
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
      const res = await fetch(`/api/policies/${id}/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool_id: attachToolId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const reason =
          res.status === 403
            ? 'Cross-org tool rejected'
            : (data?.error ?? `HTTP ${res.status}`);
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
      const res = await fetch(`/api/policies/${id}/assignments/${assignmentId}`, {
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

  const labelForAssignment = (a: Assignment): string => {
    if (a.tool_id) {
      const tool = toolsById.get(a.tool_id);
      if (tool) return `tool: ${tool.server_name} / ${tool.name}`;
      return `tool: ${a.tool_id.slice(0, 8)}…`;
    }
    if (a.server_id) {
      return `server: ${serversById.get(a.server_id) ?? a.server_id.slice(0, 8)}`;
    }
    return 'org-wide';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{name}</p>
              <Badge variant="outline" className="border text-foreground">
                {builtinKey}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">policy id {id.slice(0, 8)}…</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => {
                if (v === 'shadow' || v === 'enforce') onToggleMode(v);
              }}
              variant="outline"
              size="sm"
              disabled={pending}
              aria-label="Policy enforcement mode"
            >
              <ToggleGroupItem value="shadow">shadow</ToggleGroupItem>
              <ToggleGroupItem value="enforce">enforce</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <PolicyConfigForm
            builtinKey={builtinKey}
            config={configState}
            onChange={setConfigState}
          />
          <Button size="sm" variant="outline" className="mt-1 self-start" disabled={pending} onClick={onSaveConfig}>
            <SaveIcon className="size-4" />
            Save config
          </Button>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Assignments</Label>
          {assignments.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Not attached — policy is dormant.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs"
                >
                  <span className="text-foreground">{labelForAssignment(a)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => onDetach(a.id)}
                  >
                    Detach
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Attach to server</Label>
              <Select
                value={attachServerId ?? ''}
                onValueChange={(v) => setAttachServerId(v ? v : undefined)}
                disabled={pending || servers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={servers.length === 0 ? 'No servers yet' : 'Pick a server'} />
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
              disabled={pending || !attachServerId}
              onClick={onAttachServer}
            >
              Attach
            </Button>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Attach to tool</Label>
              <Select
                value={attachToolId ?? ''}
                onValueChange={(v) => setAttachToolId(v ? v : undefined)}
                disabled={pending || tools.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={tools.length === 0 ? 'No tools yet' : 'Pick a tool'}
                  />
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
            <Button size="sm" disabled={pending || !attachToolId} onClick={onAttachTool}>
              Attach
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild title="View 7-day timeline">
          <Link href={`/dashboard/policies/${id}`}>
            <LineChartIcon className="size-4" />
            View timeline
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-red-900 text-red-300 hover:bg-red-950 hover:text-red-200"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2Icon className="size-4" />
          Delete policy
        </Button>
      </CardFooter>
    </Card>
  );
};
