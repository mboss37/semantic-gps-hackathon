import { Skeleton } from '@/components/ui/skeleton';

// Sprint 20 WP-20.3: route designer skeleton. List view with header + canvas
// placeholder so the React Flow paint isn't a flash from blank.

const RoutesLoading = () => (
  <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-32" />
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-3 lg:col-span-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-[28rem] w-full lg:col-span-2" />
    </div>
  </div>
);

export default RoutesLoading;
