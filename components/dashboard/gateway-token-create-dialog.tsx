'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Sprint 7 WP-A.6: two-step create flow. Step 1 captures a friendly name;
// step 2 reveals the plaintext ONCE and blocks escape/backdrop dismissal so
// a stray click can't torch the only copy. The plaintext leaves memory as
// soon as the dialog closes — no local state, no toast echo.

type CreatedToken = { id: string; name: string; plaintext: string; created_at: string };

export const GatewayTokenCreateDialog = ({
  triggerLabel,
}: {
  triggerLabel?: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setName('');
    setCreated(null);
    setCopied(false);
    setPending(false);
  };

  const onOpenChange = (next: boolean) => {
    // Step 2 is plaintext-critical — only the explicit "I've saved it" path
    // may dismiss. Radix fires onOpenChange for Esc, backdrop, X button, and
    // programmatic close alike, so we gate all of them here.
    if (!next && created) return;
    setOpen(next);
    if (!next) reset();
  };

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error('Name is required');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/gateway-tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CreatedToken> & {
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (!data.id || !data.plaintext || !data.name || !data.created_at) {
        throw new Error('Malformed response from server');
      }
      setCreated({
        id: data.id,
        name: data.name,
        plaintext: data.plaintext,
        created_at: data.created_at,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setPending(false);
    }
  };

  const onCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintext);
      setCopied(true);
      toast.success('Token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Clipboard copy failed — select + copy manually');
    }
  };

  const onDismiss = () => {
    // Only valid exit from step 2. Explicit user ack that plaintext is saved.
    setOpen(false);
    reset();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          {triggerLabel ? (
            <>
              <KeyRoundIcon className="size-4" />
              {triggerLabel}
            </>
          ) : (
            <>
              <PlusIcon className="size-4" />
              Create token
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!created}
        onEscapeKeyDown={(e) => {
          if (created) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (created) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (created) e.preventDefault();
        }}
      >
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Token created</DialogTitle>
              <DialogDescription>
                This token will never be shown again — save it now.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Copy the token below into your MCP client config before closing. Once this dialog
                dismisses, the plaintext is gone.
              </div>
              <Label className="text-xs text-muted-foreground">Bearer token</Label>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                  {created.plaintext}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void onCopy()}
                  title="Copy to clipboard"
                >
                  {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Named <span className="text-foreground">{created.name}</span>. Use as{' '}
                <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;token&gt;</code>{' '}
                on requests to <code className="rounded bg-muted px-1 py-0.5">/api/mcp</code>.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onDismiss}>I&rsquo;ve saved it, close</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create gateway token</DialogTitle>
              <DialogDescription>
                Give this token a name so you remember which client it belongs to. The plaintext
                is shown once on the next screen.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="token-name">Name</Label>
                <Input
                  id="token-name"
                  placeholder="Claude Desktop (laptop)"
                  value={name}
                  maxLength={60}
                  disabled={pending}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void onSubmit();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => void onSubmit()} disabled={pending || name.trim().length === 0}>
                {pending ? 'Creating…' : 'Create token'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
