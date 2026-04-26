'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

const BUILTIN_DEFAULTS: Record<string, Record<string, unknown>> = {
  pii_redaction: {},
  allowlist: { tool_names: ['getCustomer', 'searchCustomers'] },
  rate_limit: { max_rpm: 60 },
  injection_guard: {},
  basic_auth: {},
  client_id: { allowed_ids: [], header_name: 'x-client-id' },
  ip_allowlist: { allowed_cidrs: [] },
  business_hours: {
    timezone: 'Europe/Vienna',
    windows: [
      { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start_hour: 9, end_hour: 17 },
    ],
  },
  write_freeze: { enabled: false },
  geo_fence: { allowed_regions: ['eu-west'], source: 'header' },
  agent_identity_required: {
    require_headers: ['x-agent-id'],
    verify_signature: false,
  },
  idempotency_required: { ttl_seconds: 300, key_source: 'header' },
};

type Mode = 'shadow' | 'enforce';

type PolicyCreateDialogProps = {
  servers: Array<{ id: string; name: string }>;
  // Sprint 17 WP-17.1: catalog gallery deep-links via `?builtin=<key>`. The
  // policies page forwards the key here; dialog auto-opens with the right
  // builtin + default config preselected so the user lands directly in
  // "configure this policy" without an extra click.
  initialBuiltinKey?: string;
  // Sprint 28: when the dialog is driven entirely by `?builtin=<key>` URL
  // state (no manual "+ New policy" entry point), suppress the trigger
  // button. Without this the catalog page would show a stray button next
  // to its filter pills.
  hideTrigger?: boolean;
};

export const PolicyCreateDialog = ({
  servers,
  initialBuiltinKey,
  hideTrigger = false,
}: PolicyCreateDialogProps) => {
  const router = useRouter();
  const startingBuiltin =
    initialBuiltinKey && initialBuiltinKey in BUILTIN_DEFAULTS
      ? initialBuiltinKey
      : 'pii_redaction';
  const [open, setOpen] = useState(Boolean(initialBuiltinKey));
  const [pending, setPending] = useState(false);
  const [name, setName] = useState('');
  const [builtinKey, setBuiltinKey] = useState(startingBuiltin);
  const [config, setConfig] = useState<Record<string, unknown>>(
    BUILTIN_DEFAULTS[startingBuiltin] ?? {},
  );
  const [mode, setMode] = useState<Mode>('shadow');
  const [attachServerId, setAttachServerId] = useState<string | undefined>(undefined);

  // Clean the `?builtin=` deep-link param off the URL on close so a refresh
  // doesn't silently re-open the dialog, and a manual close doesn't leave a
  // stale param behind for the next navigation.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && initialBuiltinKey) {
      router.replace('/dashboard/policies');
    }
  };

  const onSubmit = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || `${builtinKey} (${mode})`,
          builtin_key: builtinKey,
          config,
          enforcement_mode: mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const policyId = data?.policy?.id as string | undefined;

      if (policyId && attachServerId) {
        await fetch(`/api/policies/${policyId}/assignments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ server_id: attachServerId }),
        });
      }
      toast.success('Policy created');
      handleOpenChange(false);
      setName('');
      setAttachServerId(undefined);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button>
            <PlusIcon className="size-4" />
            New policy
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create policy</DialogTitle>
          <DialogDescription>
            Policies start in <span className="text-zinc-200">shadow</span>, flip to enforce once
            the audit looks clean.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="policy-name">Name</Label>
            <Input
              id="policy-name"
              placeholder="Redact PII in outputs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Built-in</Label>
            <Select
              value={builtinKey}
              onValueChange={(v) => {
                if (v === null) return;
                setBuiltinKey(v);
                setConfig(BUILTIN_DEFAULTS[v] ?? {});
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pii_redaction">pii_redaction</SelectItem>
                <SelectItem value="allowlist">allowlist</SelectItem>
                <SelectItem value="rate_limit">rate_limit</SelectItem>
                <SelectItem value="injection_guard">injection_guard</SelectItem>
                <SelectItem value="basic_auth">basic_auth</SelectItem>
                <SelectItem value="client_id">client_id</SelectItem>
                <SelectItem value="ip_allowlist">ip_allowlist</SelectItem>
                <SelectItem value="business_hours">business_hours</SelectItem>
                <SelectItem value="write_freeze">write_freeze</SelectItem>
                <SelectItem value="geo_fence">geo_fence</SelectItem>
                <SelectItem value="agent_identity_required">agent_identity_required</SelectItem>
                <SelectItem value="idempotency_required">idempotency_required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Config</Label>
            <PolicyConfigForm
              builtinKey={builtinKey}
              config={config}
              onChange={setConfig}
            />
          </div>

          <div className="grid gap-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => v && setMode(v as Mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shadow">shadow (log only)</SelectItem>
                <SelectItem value="enforce">enforce (block or redact)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Attach to server (optional)</Label>
            <Select
              value={attachServerId ?? ''}
              onValueChange={(v) => setAttachServerId(v ? v : undefined)}
              disabled={servers.length === 0}
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
            <p className="text-xs text-zinc-500">
              Leave empty for an org-wide policy (applies to every server).
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Creating…' : 'Create policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
