'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRightIcon, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyEditDialog } from '@/components/dashboard/policy-edit-dialog';
import { DIMENSION_LABELS, type CatalogEntry } from '@/lib/policies/catalog';

// Sprint 28 IA flip + edit-in-place: each catalog card surfaces its applied
// instances inline as small editable chips. Footer flips between "Apply to
// my org" (no instances yet) and "Apply another" (already in use). Clicking
// a chip opens `PolicyEditDialog` for that specific policy_id — no
// navigation, no separate active page.

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

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{entry.title}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              {DIMENSION_LABELS[entry.dimension]}
            </Badge>
          </div>
          <code className="font-mono text-xs text-muted-foreground">{entry.builtin_key}</code>
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          <p className="text-sm text-muted-foreground">{entry.description}</p>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Config: </span>
            {entry.config_keys.join(', ')}
          </div>

          {attachedCount > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Active in your org
              </span>
              <ul className="flex flex-col gap-1.5">
                {instances.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setEditingId(p.id)}
                      className="group flex w-full items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs transition-colors hover:border-foreground/30 hover:bg-muted/50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                        <span className="truncate font-mono text-foreground/90">{p.name}</span>
                        <span
                          className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                            p.enforcement_mode === 'enforce'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                              : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                          }`}
                        >
                          {p.enforcement_mode}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground transition-colors group-hover:text-foreground">
                        <Pencil className="size-3" />
                        <span className="font-mono uppercase tracking-wider">Edit</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button asChild size="sm" variant={attachedCount > 0 ? 'outline' : 'default'} className="w-full">
            <Link href={`/dashboard/policies?builtin=${entry.builtin_key}`}>
              {attachedCount > 0 ? 'Apply another' : 'Apply to my org'}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </CardFooter>
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
