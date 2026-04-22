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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const DEMO_SPEC_URL = '/demo-openapi.json';

type Tab = 'url' | 'spec' | 'mcp';

export const ImportDialog = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [spec, setSpec] = useState('');
  const [name, setName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpName, setMcpName] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [pending, setPending] = useState(false);

  const loadDemoSpec = async () => {
    try {
      const res = await fetch(DEMO_SPEC_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSpec(JSON.stringify(json, null, 2));
      setName('CustomerCloud CRM (demo)');
      toast.success('Demo spec loaded — review and Import');
    } catch {
      toast.error('Could not load demo spec');
    }
  };

  const onSubmitOpenApi = async () => {
    setPending(true);
    try {
      const body: Record<string, unknown> = name ? { name } : {};
      if (tab === 'url') {
        if (!url.trim()) throw new Error('URL required');
        body.url = url.trim();
      } else {
        if (!spec.trim()) throw new Error('Spec required');
        try {
          body.spec = JSON.parse(spec);
        } catch {
          throw new Error('Spec is not valid JSON');
        }
      }
      const res = await fetch('/api/openapi-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      toast.success(`Imported "${data.name}" · ${data.tool_count} tools`);
      closeAndReset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setPending(false);
    }
  };

  const onSubmitMcp = async () => {
    if (!mcpUrl.trim()) {
      toast.error('MCP server URL required');
      return;
    }
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        name: mcpName.trim() || mcpUrl.trim(),
        origin_url: mcpUrl.trim(),
      };
      if (authType === 'bearer') {
        if (!bearerToken.trim()) throw new Error('Bearer token required');
        body.auth = { type: 'bearer', token: bearerToken.trim() };
      } else {
        body.auth = { type: 'none' };
      }
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      toast.success(`Added MCP server "${data.name}"`);
      closeAndReset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setPending(false);
    }
  };

  const closeAndReset = () => {
    setOpen(false);
    setUrl('');
    setSpec('');
    setName('');
    setMcpUrl('');
    setMcpName('');
    setBearerToken('');
    setAuthType('none');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="size-4" />
          Add Server
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Server</DialogTitle>
          <DialogDescription>
            Import an OpenAPI spec to generate MCP tools, or register an MCP server directly.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url">OpenAPI URL</TabsTrigger>
            <TabsTrigger value="spec">Inline Spec</TabsTrigger>
            <TabsTrigger value="mcp">MCP Server</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="server-name-url">Server name (optional)</Label>
              <Input
                id="server-name-url"
                value={name}
                placeholder="Defaults to spec.info.title"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="spec-url">Spec URL</Label>
              <Input
                id="spec-url"
                placeholder="https://example.com/openapi.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Routed through the SSRF guard — private IPs and loopback are rejected.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="spec" className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="server-name-spec">Server name (optional)</Label>
              <Input
                id="server-name-spec"
                value={name}
                placeholder="Defaults to spec.info.title"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="spec-body">OpenAPI JSON</Label>
                <Button type="button" variant="ghost" size="sm" onClick={loadDemoSpec}>
                  Load demo spec
                </Button>
              </div>
              <Textarea
                id="spec-body"
                rows={10}
                spellCheck={false}
                placeholder='{"openapi":"3.1.0", ...}'
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="mcp" className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mcp-name">Server name (optional)</Label>
              <Input
                id="mcp-name"
                value={mcpName}
                placeholder="Defaults to URL"
                onChange={(e) => setMcpName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mcp-url">MCP Server URL</Label>
              <Input
                id="mcp-url"
                placeholder="https://api.example.com/mcp"
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                HTTP-Streamable transport endpoint. The gateway proxies all tool calls through here.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Authentication</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as 'none' | 'bearer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {authType === 'bearer' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="bearer-token">Bearer Token</Label>
                <Input
                  id="bearer-token"
                  type="password"
                  placeholder="sk-…"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Stored encrypted (AES-256-GCM). Never logged or exposed.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={closeAndReset}>Cancel</Button>
          </DialogClose>
          <Button
            onClick={tab === 'mcp' ? onSubmitMcp : onSubmitOpenApi}
            disabled={pending}
          >
            {pending ? 'Adding…' : tab === 'mcp' ? 'Add MCP Server' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
