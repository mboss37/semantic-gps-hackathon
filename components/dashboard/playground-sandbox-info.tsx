'use client';

import { InfoIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Small client island for the page-level sandbox-only warning. Lives next
// to the Playground `<h1>`. Pulled out of `app/dashboard/playground/page.tsx`
// so the radix Tooltip's `asChild`-wrapped button doesn't hydration-mismatch
// when rendered from inside a server component.

export const PlaygroundSandboxInfo = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label="Sandbox-only warning"
        className="text-amber-300/80 transition-colors hover:text-amber-300"
      >
        <InfoIcon className="size-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" className="max-w-[320px] text-left normal-case">
      <p className="mb-1 font-semibold text-amber-200">Sandbox MCPs only</p>
      <p className="text-amber-100/90">
        Use the Playground to validate configurations against{' '}
        <span className="font-semibold">sandbox or staging</span> environments. Never validate
        against production systems, connect production via your agent runtime, not here.
      </p>
    </TooltipContent>
  </Tooltip>
);
