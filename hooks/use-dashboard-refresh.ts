'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Sprint 21 WP-21.5: shared refresh primitive for the dashboard.
//   - router.refresh() reloads the RSC tree → KPI cards, recent events, etc.
//   - A 'semgps:dashboard-refresh' window CustomEvent broadcasts to any
//     client-state component that holds its own fetch state (e.g. the
//     traffic chart). Those components add a one-line listener and re-run
//     their effect.
//
// Debounced 2s to absorb the visibilitychange + focus double-fire on tab
// return, and to prevent click-storm on the manual refresh button.

export const DASHBOARD_REFRESH_EVENT = 'semgps:dashboard-refresh' as const;
const DEBOUNCE_MS = 2000;
const SPIN_FEEDBACK_MS = 500;

export const useDashboardRefresh = () => {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const lastFiredRef = useRef(0);

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastFiredRef.current < DEBOUNCE_MS) return;
    lastFiredRef.current = now;

    setIsPending(true);
    router.refresh();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT));
    }
    window.setTimeout(() => setIsPending(false), SPIN_FEEDBACK_MS);
  }, [router]);

  return { refresh, isPending };
};
