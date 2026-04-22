'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SaveIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Mode = 'shadow' | 'enforce';

type Assignment = {
  id: string;
  policy_id: string;
  server_id: string | null;
  tool_id: string | null;
};

type Props = {
  id: string;
  name: string;
  builtinKey: string;
  config: Record<string, unknown>;
  mode: Mode;
  assignments: Assignment[];
  servers: Array<{ id: string; name: string }>;
};

export const PolicyRow = ({ id, name, builtinKey, config, mode, assignments, servers }: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [configText, setConfigText] = useState(JSON.stringify(config, null, 2));
  const [attachServerId, setAttachServerId] = useState<string | undefined>(undefined);
  const serversById = new Map(servers.map((s) => [s.id, s.name]));

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
    let parsed: unknown;
    try {
      parsed = JSON.parse(configText);
    } catch {
      toast.error('Config is not valid JSON');
      return;
    }
    patch({ config: parsed as Record<string, unknown> }, 'Config saved');
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
            <Select
              value={mode}
              onValueChange={(v) => v && onToggleMode(v as Mode)}
              disabled={pending}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shadow">shadow</SelectItem>
                <SelectItem value="enforce">enforce</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Config (JSON)</Label>
          <Textarea
            rows={4}
            spellCheck={false}
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            className="font-mono text-xs"
          />
          <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={onSaveConfig}>
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
                  className="flex items-center justify-between rounded border border bg-background px-3 py-1.5 text-xs"
                >
                  <span className="text-foreground">
                    {a.server_id
                      ? `server: ${serversById.get(a.server_id) ?? a.server_id.slice(0, 8)}`
                      : a.tool_id
                        ? `tool: ${a.tool_id.slice(0, 8)}`
                        : 'org-wide'}
                  </span>
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
        </div>
      </CardContent>
      <CardFooter>
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
