import { requireAuth, UnauthorizedError } from '@/lib/auth';
import {
  fetchCallVolume,
  fetchPiiByPattern,
  fetchPolicyBlocks,
} from '@/lib/monitoring/fetch';
import { MonitoringBlocksChart } from '@/components/dashboard/monitoring-blocks-chart';
import { MonitoringPiiChart } from '@/components/dashboard/monitoring-pii-chart';
import { MonitoringVolumeChart } from '@/components/dashboard/monitoring-volume-chart';

export const dynamic = 'force-dynamic';

const DAYS = 7;

const MonitoringPage = async () => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
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

  const [volume, blocks, pii] = await Promise.all([
    fetchCallVolume(supabase, organization_id, DAYS),
    fetchPolicyBlocks(supabase, organization_id, DAYS),
    fetchPiiByPattern(supabase, organization_id, DAYS),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Monitoring</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Last {DAYS} days · live from mcp_events. Populate by running Playground presets or gateway
          calls.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Call volume</h2>
          <p className="text-xs text-zinc-500">Allowed / blocked / error per day.</p>
        </div>
        <MonitoringVolumeChart series={volume} />
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">Policy violations over time</h2>
          <p className="text-xs text-zinc-500">
            Stacks per-policy blocks (shadow + enforce). Top 5 by total; rest merged as &ldquo;other&rdquo;.
          </p>
        </div>
        <MonitoringBlocksChart series={blocks} />
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-sm font-medium text-zinc-100">PII detections by pattern</h2>
          <p className="text-xs text-zinc-500">
            Counts per pattern emitted by the redaction runner (phone, email, ssn, …).
          </p>
        </div>
        <MonitoringPiiChart data={pii} />
      </section>
    </div>
  );
};

export default MonitoringPage;
