'use client';

import { useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';

import { CopyButton } from '@/components/dashboard/copy-button';
import { cn } from '@/lib/utils';

export type ServerDetailToolView = {
  id: string;
  name: string;
  description: string | null;
  display_name: string | null;
  display_description: string | null;
  input_schema: unknown;
  calls24h: number;
  errors24h: number;
};

type Props = {
  tools: ServerDetailToolView[];
};

const formatSchema = (schema: unknown): string => {
  try {
    return JSON.stringify(schema ?? {}, null, 2);
  } catch {
    return '{}';
  }
};

const hasUsefulSchema = (schema: unknown): boolean => {
  if (!schema || typeof schema !== 'object') return false;
  const props = (schema as Record<string, unknown>).properties;
  return !!props && typeof props === 'object' && Object.keys(props).length > 0;
};

export const ServerToolsTable = ({ tools }: Props) => {
  const [openId, setOpenId] = useState<string | null>(null);

  if (tools.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center">
        <p className="font-mono text-[11px] text-muted-foreground">
          No tools discovered, origin may be unreachable
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-card/30">
      <div
        className="grid grid-cols-[1.25rem_minmax(180px,240px)_1fr_max-content] items-center gap-x-4 border-b border-border/60 bg-muted/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
        role="row"
      >
        <span aria-hidden />
        <span>Tool</span>
        <span>Description</span>
        <span className="text-right">24h</span>
      </div>
      <ul className="divide-y divide-border/40">
        {tools.map((t) => {
          const isOpen = openId === t.id;
          const description = t.display_description ?? t.description;
          const schemaIsUseful = hasUsefulSchema(t.input_schema);
          const hasErrors = t.errors24h > 0;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : t.id)}
                className="grid w-full grid-cols-[1.25rem_minmax(180px,240px)_1fr_max-content] items-baseline gap-x-4 px-4 py-3 text-left transition-colors hover:bg-muted/20"
              >
                <ChevronRightIcon
                  className={cn(
                    'size-3.5 shrink-0 self-center text-muted-foreground transition-transform',
                    isOpen && 'rotate-90',
                  )}
                />
                <code className="truncate font-mono text-xs text-foreground/90">{t.name}</code>
                <p className="truncate text-xs text-muted-foreground">
                  {description ?? <span className="opacity-50">-</span>}
                </p>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span className="text-foreground">{t.calls24h}</span>
                  {hasErrors ? (
                    <span className="ml-2 text-amber-300">
                      <span className="font-medium">{t.errors24h}</span> err
                    </span>
                  ) : null}
                </span>
              </button>

              {isOpen ? (
                <div className="flex flex-col gap-3 border-t border-border/40 bg-muted/10 px-4 py-4">
                  {t.display_name && t.display_name !== t.name ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Display name
                      </span>
                      <p className="text-xs">{t.display_name}</p>
                    </div>
                  ) : null}
                  {t.display_description && t.display_description !== t.description ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Origin description
                      </span>
                      <p className="text-xs text-muted-foreground">{t.description ?? '-'}</p>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Input schema
                      </span>
                      {schemaIsUseful ? (
                        <CopyButton value={formatSchema(t.input_schema)} compact />
                      ) : null}
                    </div>
                    {schemaIsUseful ? (
                      <pre className="scrollbar-dark max-h-72 overflow-auto rounded-md border border-border/60 bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                        {formatSchema(t.input_schema)}
                      </pre>
                    ) : (
                      <p className="font-mono text-[11px] text-muted-foreground/80">
                        No input schema declared by origin
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
