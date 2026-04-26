import { Skeleton } from '@/components/ui/skeleton';

// Sprint 20 WP-20.3: monitoring skeleton, three Recharts widgets stacked.

const MonitoringLoading = () => (
  <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
    <Skeleton className="h-8 w-48" />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full" />
      ))}
    </div>
  </div>
);

export default MonitoringLoading;
