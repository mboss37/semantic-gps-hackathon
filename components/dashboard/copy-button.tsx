'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

type Props = { value: string; label?: string };

export const CopyButton = ({ value, label = 'Copy' }: Props) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed — select manually');
    }
  };
  return (
    <Button variant="secondary" size="sm" onClick={() => void onCopy()}>
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {copied ? 'Copied!' : label}
    </Button>
  );
};
