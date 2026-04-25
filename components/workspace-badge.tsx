'use client';

import Link from 'next/link';
import { ChevronsUpDownIcon } from 'lucide-react';

// Sprint 22 WP-22.5 follow-on: workspace identity badge between the brand
// header and the nav groups. Slack/Linear/Vercel pattern — gives the user a
// clear "you are here" workspace indicator and previews the V2 multi-org
// switcher shape (the chevron + clickable card hints at it). For MVP the
// click jumps to /dashboard/settings so it's functional, not decorative.

type Props = {
  orgName: string;
};

const initialOf = (name: string): string => {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '·';
};

export const WorkspaceBadge = ({ orgName }: Props) => {
  const initial = initialOf(orgName);
  const display = orgName.trim() || 'Untitled workspace';

  return (
    <Link
      href="/dashboard/settings"
      className="group/workspace block focus-visible:outline-none"
      aria-label={`Edit workspace ${display}`}
      title="Edit workspace settings"
    >
      <div className="rounded-lg bg-gradient-to-br from-violet-500/40 via-fuchsia-500/30 to-violet-500/40 p-px transition-opacity hover:from-violet-500/60 hover:to-fuchsia-500/60 group-focus-visible/workspace:from-violet-500 group-focus-visible/workspace:to-fuchsia-500">
        <div className="flex items-center gap-2.5 rounded-[7px] bg-sidebar px-2.5 py-2">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-inner">
            {initial}
            <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Workspace
            </span>
            <span className="truncate text-sm font-medium">{display}</span>
          </div>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/workspace:text-foreground" />
        </div>
      </div>
    </Link>
  );
};
