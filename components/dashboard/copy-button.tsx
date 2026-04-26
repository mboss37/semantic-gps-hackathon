'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

type Props = {
  value: string;
  label?: string;
  /** Compact variant: ghost icon-only, sized to align inline with body text. */
  compact?: boolean;
  /** Visual variant for the non-compact form. Default keeps existing call sites. */
  variant?: 'secondary' | 'outline';
};

export const CopyButton = ({
  value,
  label = 'Copy',
  compact = false,
  variant = 'secondary',
}: Props) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed, select manually');
    }
  };
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        onClick={() => void onCopy()}
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </Button>
    );
  }
  return (
    <Button variant={variant} size="sm" onClick={() => void onCopy()}>
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {copied ? 'Copied!' : label}
    </Button>
  );
};
