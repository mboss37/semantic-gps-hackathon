'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRightIcon, HelpCircle, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PolicyEditDialog } from '@/components/dashboard/policy-edit-dialog';
import { DIMENSION_LABELS, type CatalogEntry } from '@/lib/policies/catalog';
import { cn } from '@/lib/utils';

type Mode = 'shadow' | 'enforce';

type PolicyInstance = {
  id: string;
  name: string;
  builtin_key: string;
  config: Record<string, unknown>;
  enforcement_mode: Mode;
};

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
  entry: CatalogEntry;
  instances: PolicyInstance[];
  assignmentsByPolicy: Map<string, Assignment[]>;
  servers: ServerOption[];
  tools: ToolOption[];
};

// Mode pill is read-only on the catalog card, flipping mode happens inside
// `<PolicyEditDialog>` so the mutation surface stays in one canonical place.
// Color semantics:
//   shadow  → zinc (passive, log-only, observation, no enforcement)
//   enforce → amber (active, blocking, warning-tone signals "this will reject")
const MODE_BADGE_CLASS: Record<Mode, string> = {
  shadow: 'border-zinc-500/40 bg-zinc-500/15 text-zinc-200',
  enforce: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
};

export const PolicyCatalogCard = ({
  entry,
  instances,
  assignmentsByPolicy,
  servers,
  tools,
}: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = instances.find((p) => p.id === editingId) ?? null;
  const editingAssignments = editingId ? (assignmentsByPolicy.get(editingId) ?? []) : [];

  const attachedCount = instances.length;
  const isApplied = attachedCount > 0;

  return (
    <>
      <Card
        className={cn(
          'flex flex-col gap-3 py-4',
          isApplied && 'border-emerald-500/40',
        )}
      >
        <CardHeader className="space-y-1.5 px-5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm">{entry.title}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
              {DIMENSION_LABELS[entry.dimension]}
            </Badge>
          </div>
          <code className="font-mono text-[11px] text-muted-foreground">{entry.builtin_key}</code>
          {/* Config row sits in the header so it lands at the same Y on every
              card regardless of description length. */}
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Config: </span>
            {entry.config_keys.join(', ')}
          </p>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-2 px-5">
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>

          {isApplied && (
            <ul className="flex flex-col gap-1.5 pt-1">
              {instances.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Mode
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="What is shadow vs enforce?"
                            className="text-muted-foreground/70 transition-colors hover:text-foreground"
                          >
                            <HelpCircle className="size-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-left normal-case tracking-normal">
                          <p className="mb-1">
                            <span className="font-semibold">Shadow</span>, log every violation, never block.
                            Use this to audit a new policy against real traffic.
                          </p>
                          <p>
                            <span className="font-semibold">Enforce</span>, block or redact at the gateway.
                            Flip here once the shadow timeline looks clean.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span
                      className={cn(
                        'inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] font-medium uppercase tracking-wider',
                        MODE_BADGE_CLASS[p.enforcement_mode],
                      )}
                    >
                      {p.enforcement_mode}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-[11px]"
                    onClick={() => setEditingId(p.id)}
                  >
                    <Pencil className="size-3" />
                    Edit policy
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>

        {/* Apply CTA disappears once the policy is applied, adding it to more
            servers / tools happens inside the Edit dialog's assignments
            section. Keeps the catalog card's footer reserved for the
            "first-touch" action only. */}
        {!isApplied && (
          <CardFooter className="px-5">
            <Button asChild size="sm" className="w-full">
              <Link href={`/dashboard/policies?builtin=${entry.builtin_key}`}>
                Apply to my org
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      {editing ? (
        <PolicyEditDialog
          key={editing.id}
          open={editingId !== null}
          onOpenChange={(next) => {
            if (!next) setEditingId(null);
          }}
          policy={editing}
          assignments={editingAssignments}
          servers={servers}
          tools={tools}
        />
      ) : null}
    </>
  );
};
