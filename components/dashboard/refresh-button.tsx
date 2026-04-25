'use client';

import { RefreshCwIcon } from 'lucide-react';

import { useDashboardRefresh } from '@/hooks/use-dashboard-refresh';

// Sprint 21 WP-21.5: manual refresh button in the site header. Auto-refresh
// on tab focus is the primary mechanism (see SiteHeader's visibilitychange
// listener); this is the explicit "I want it now" override.

export const RefreshButton = () => {
  const { refresh, isPending } = useDashboardRefresh();

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      aria-label="Refresh dashboard"
      title="Refresh"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/10 bg-background/40 text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-60"
    >
      <RefreshCwIcon
        className={`size-3.5 ${isPending ? 'animate-spin' : ''}`}
      />
    </button>
  );
};
