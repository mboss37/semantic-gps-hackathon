'use client';

import { CopyButton } from '@/components/dashboard/copy-button';
import { cn } from '@/lib/utils';

// Shared code-block primitive. Replaces the per-page reinvented `<pre>`
// chrome that drifted across audit / connect / playground / server tools.
// Same dark muted shell, mono `text-[11px] leading-relaxed`, inline compact
// copy button anchored top-right. Variant `tone` lets a caller dim it
// against a Card surface (subtle) or stand it apart on a flat surface
// (default). `wrap` swaps `overflow-x-auto` for `whitespace-pre-wrap` for
// long values that should wrap rather than scroll horizontally.

type Props = {
  code: string;
  ariaLabel?: string;
  tone?: 'default' | 'subtle';
  wrap?: boolean;
  className?: string;
};

const TONE_BG: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-muted/40',
  subtle: 'bg-background/60',
};

export const CodeBlock = ({
  code,
  ariaLabel,
  tone = 'default',
  wrap = false,
  className,
}: Props) => (
  <div className={cn('relative rounded-md border', TONE_BG[tone], className)} aria-label={ariaLabel}>
    <div className="absolute right-1.5 top-1.5">
      <CopyButton value={code} compact />
    </div>
    <pre
      className={cn(
        'p-3 pr-12 font-mono text-[11px] leading-relaxed text-foreground/90',
        wrap ? 'whitespace-pre-wrap break-all' : 'overflow-x-auto',
      )}
    >
      {code}
    </pre>
  </div>
);
