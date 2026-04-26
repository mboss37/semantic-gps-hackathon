'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImportIcon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

// Sprint 28 WP-28.3: Routes list authoring affordance. JSON-import only;
// visual editor lives in v2 (BACKLOG). The sample matches the
// `sales_escalation` route in scripts/bootstrap-local-demo.sql with a
// renamed `name` so it doesn't collide with the seeded route on first
// import.

const SAMPLE_ROUTE = {
  name: 'sales_escalation_v2',
  description: 'Find an account, look up its primary contact, and log a follow-up task.',
  steps: [
    {
      step_order: 1,
      server_name: 'Demo Salesforce',
      tool_name: 'find_account',
      input_mapping: { query: '$inputs.account_name' },
      output_capture_key: 'account',
    },
    {
      step_order: 2,
      server_name: 'Demo Salesforce',
      tool_name: 'find_contact',
      input_mapping: { account_id: '$steps.account.records.0.Id' },
      output_capture_key: 'contact',
    },
    {
      step_order: 3,
      server_name: 'Demo Salesforce',
      tool_name: 'create_task',
      input_mapping: {
        subject: '$inputs.task_subject',
        who_id: '$steps.contact.records.0.Id',
      },
      output_capture_key: 'task',
      rollback_server_name: 'Demo Salesforce',
      rollback_tool_name: 'delete_task',
      rollback_input_mapping: { task_id: '$steps.task.id' },
    },
  ],
};

const SAMPLE_JSON = JSON.stringify(SAMPLE_ROUTE, null, 2);

type ApiError = { error?: string; details?: unknown };

const formatApiError = (status: number, body: ApiError | null): string => {
  if (!body) return `Import failed (HTTP ${status})`;
  if (body.error === 'duplicate') {
    return 'A route with that name already exists in your org. Rename and try again.';
  }
  if (body.error === 'tool not found' && typeof body.details === 'string') {
    return `${body.details}. Register the server + tool first, or fix the names in the JSON.`;
  }
  if (body.error === 'invalid body') {
    return 'JSON does not match the expected schema. See the sample for the canonical shape.';
  }
  if (typeof body.details === 'string') return body.details;
  return body.error ? `${body.error} (HTTP ${status})` : `Import failed (HTTP ${status})`;
};

export const RouteImportDialog = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setJsonText('');
    setError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleImport = async () => {
    setError(null);
    let body: unknown;
    try {
      body = JSON.parse(jsonText);
    } catch {
      setError('Invalid JSON. Check for trailing commas, unmatched braces, or stray quotes.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { name?: string } | null;
        toast.success(data?.name ? `Route '${data.name}' imported` : 'Route imported');
        setOpen(false);
        reset();
        router.refresh();
        return;
      }
      const errBody = (await res.json().catch(() => null)) as ApiError | null;
      setError(formatApiError(res.status, errBody));
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ImportIcon className="size-4" />
          Import route
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import route</DialogTitle>
          <DialogDescription>
            Paste a route JSON. Tools are referenced by{' '}
            <code className="rounded bg-muted px-1 font-mono text-xs">server_name</code> +{' '}
            <code className="rounded bg-muted px-1 font-mono text-xs">tool_name</code>, so the
            same JSON works across orgs as long as the upstream servers + tools are registered.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Route JSON
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setJsonText(SAMPLE_JSON);
                setError(null);
              }}
              disabled={submitting}
            >
              Load sample
            </Button>
          </div>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{ "name": "...", "description": "...", "steps": [...] }'
            className="scrollbar-dark min-h-[320px] font-mono text-xs"
            spellCheck={false}
            disabled={submitting}
          />
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={submitting || !jsonText.trim()}>
            {submitting ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
