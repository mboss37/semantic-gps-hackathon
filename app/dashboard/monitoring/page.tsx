import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { MonitoringDashboard } from '@/components/dashboard/monitoring-dashboard';

export const dynamic = 'force-dynamic';

const MonitoringPage = async () => {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return (
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm text-zinc-400">Sign in to view Monitoring.</p>
        </div>
      );
    }
    throw e;
  }

  return <MonitoringDashboard />;
};

export default MonitoringPage;
