import { Skeleton } from '@/components/ui/skeleton';

// Sprint 20 WP-20.3: top-level dashboard loading skeleton. Wraps every
// /dashboard/* route that does not ship its own loading.tsx. Renders inside
// SidebarInset → the sidebar + header stay stable; only this content swaps.
// Shape, not content, update when the page layout structure changes.

const DashboardLoading = () => (
  <div className="@container/main flex flex-1 flex-col gap-2">
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  </div>
);

export default DashboardLoading;
