'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SparklesIcon } from 'lucide-react';

import { RefreshButton } from '@/components/dashboard/refresh-button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useDashboardRefresh } from '@/hooks/use-dashboard-refresh';
import { useRealtimeDashboardEvents } from '@/hooks/use-realtime-dashboard-events';

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
  const { refresh } = useDashboardRefresh();

  // Sprint 22 WP-22.1: push-based refresh on every gateway call. Mounted
  // here (singleton on dashboard pages) so one Realtime channel covers
  // every screen the user can see.
  useRealtimeDashboardEvents();

  // Sprint 21 WP-21.5: tab-focus auto-refresh. visibilitychange fires when
  // the user returns to this tab from Postman / Claude Desktop / wherever.
  // The hook itself debounces, so the parallel `focus` listener is harmless
  // but covers the case of a same-tab window refocus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-sidebar transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
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
          <RefreshButton />
        </div>
      </div>
    </header>
  );
}
