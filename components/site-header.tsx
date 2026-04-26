'use client';

import { Zap } from 'lucide-react';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { useRealtimeDashboardEvents } from '@/hooks/use-realtime-dashboard-events';

// Pure chrome strip, sidebar trigger on the left, competition/build tag on
// the right. Org name lives in the sidebar's WorkspaceBadge, not here, so the
// header stays brand-only across every dashboard page. Realtime channel is
// mounted once here as a singleton so every page picks up live mcp_events
// updates without a manual refresh.

export function SiteHeader() {
  useRealtimeDashboardEvents();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-sidebar transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
            <Zap className="size-3.5" />
            Anthropic Hackathon 2026
          </span>
        </div>
      </div>
    </header>
  );
}
