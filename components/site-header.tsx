'use client';

import { usePathname } from 'next/navigation';
import { SparklesIcon } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

// Sprint 21 WP-21.2: page title on the left, brand-presence cluster on the
// right — "Built with Opus 4.7" pill + optional org name. First three seconds
// after a judge logs in: this is the framing they see.

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/servers': 'Servers',
  '/dashboard/routes': 'Routes',
  '/dashboard/relationships': 'Relationships',
  '/dashboard/playground': 'Playground',
  '/dashboard/graph': 'Workflow Graph',
  '/dashboard/tokens': 'Tokens',
  '/dashboard/policies': 'Policies',
  '/dashboard/monitoring': 'Monitoring',
  '/dashboard/audit': 'Audit',
};

const resolveTitle = (pathname: string): string => {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = Object.keys(TITLES).find((p) => p !== '/dashboard' && pathname.startsWith(p));
  return base ? TITLES[base] : 'Dashboard';
};

type Props = {
  orgName?: string;
};

export function SiteHeader({ orgName }: Props = {}) {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-3">
          {orgName ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {orgName}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
            <SparklesIcon className="size-3.5" />
            Built with Opus 4.7
          </span>
        </div>
      </div>
    </header>
  );
}
