'use client';

import { useEffect } from 'react';
import { SparklesIcon } from 'lucide-react';

import { RefreshButton } from '@/components/dashboard/refresh-button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useDashboardRefresh } from '@/hooks/use-dashboard-refresh';
import { useRealtimeDashboardEvents } from '@/hooks/use-realtime-dashboard-events';

// Pure chrome strip — sidebar trigger on the left, brand-presence cluster on
// the right. Page titles live in the main content (each page owns its own
// h1 + description). Killed the duplicate title in this strip Sprint 24
// after the doubled-headline UX review.

type Props = {
  orgName?: string;
};

export function SiteHeader({ orgName }: Props = {}) {
  const { refresh } = useDashboardRefresh();

  useRealtimeDashboardEvents();

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
