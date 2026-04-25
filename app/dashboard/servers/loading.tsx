import { Skeleton } from '@/components/ui/skeleton';

// Sprint 20 WP-20.3: server-list skeleton. Mirrors the ServerCard grid shape
// so the swap is visually quiet.

const ServersLoading = () => (
  <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-32" />
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full" />
      ))}
    </div>
  </div>
);

export default ServersLoading;
