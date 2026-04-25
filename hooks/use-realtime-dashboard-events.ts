'use client';

import { useEffect, useRef } from 'react';

import { createClient } from '@/lib/supabase/client';

import { useDashboardRefresh } from './use-dashboard-refresh';

// Sprint 22 WP-22.1: push-based dashboard refresh.
//
// Subscribes to postgres_changes INSERT on `public.mcp_events` via the
// browser Supabase client. Every gateway call → row insert → channel
// event → dashboard refresh, no manual click required.
//
// Mount once at the dashboard shell (SiteHeader). Consumers of
// useDashboardRefresh that only need the manual refresh fn (e.g. the
// header refresh button) do NOT call this hook — one channel per tab.
//
// RLS isolation: the browser client carries the user JWT, and the
// custom_access_token_hook stamps `organization_id`. Realtime applies
// the same `org_isolation` RLS policy used by jwt_org_id() before
// fanning out — cross-org rows never reach this channel. Verified by
// the cross-org isolation check in the WP-22.1 manual test plan.
//
// Debouncing: useDashboardRefresh enforces a 2s debounce, so a burst
// of INSERTs collapses to a single router.refresh() + dashboard event.
export const useRealtimeDashboardEvents = () => {
  const { refresh } = useDashboardRefresh();
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const wireUp = async () => {
      // Force the realtime websocket to carry the user JWT — without this,
      // the channel auth context is anon and RLS on mcp_events drops every
      // event before fanout. createBrowserClient sets this on init, but
      // not always before the first .subscribe(), depending on cookie
      // hydration timing in the App Router.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        await supabase.realtime.setAuth(session.access_token);
      } else {
        console.warn('[realtime] no session on mount — channel will be anon');
      }

      const channel = supabase
        .channel('dashboard:mcp_events')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'mcp_events' },
          () => {
            refreshRef.current();
          },
        )
        .subscribe((status, err) => {
          // Only warn on terminal/error states — SUBSCRIBED success path
          // is the normal case and doesn't need a console line per mount.
          if (status !== 'SUBSCRIBED' && status !== 'CLOSED') {
            console.warn('[realtime] dashboard channel', status, err ?? '');
          }
        });

      return channel;
    };

    const channelPromise = wireUp();
    return () => {
      cancelled = true;
      void channelPromise.then((channel) => {
        if (channel) void supabase.removeChannel(channel);
      });
    };
  }, []);
};
