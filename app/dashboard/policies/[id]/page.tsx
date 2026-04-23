import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PolicyTimelineChart } from '@/components/dashboard/policy-timeline-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Sprint 12 WP-12.4 (I.4): per-policy detail page. Surfaces the 7-day
// shadow→enforce timeline alongside policy metadata so judges can audit
// the would-have-blocked count before flipping to enforce.

export const dynamic = 'force-dynamic';

type PolicyRecord = {
  id: string;
  name: string;
  builtin_key: string;
  enforcement_mode: 'shadow' | 'enforce';
  created_at: string;
};

type Params = Promise<{ id: string }>;

const PolicyDetailPage = async ({ params }: { params: Params }) => {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('policies')
    .select('id, name, builtin_key, enforcement_mode, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) notFound();
  const policy = data as PolicyRecord;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/policies">
            <ArrowLeftIcon className="size-4" />
            Back to policies
          </Link>
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{policy.name}</h1>
            <Badge variant="outline" className="border text-foreground">
              {policy.builtin_key}
            </Badge>
            <Badge
              variant={policy.enforcement_mode === 'enforce' ? 'destructive' : 'secondary'}
            >
              {policy.enforcement_mode}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">policy id {policy.id}</p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Last 7 days</h2>
        <PolicyTimelineChart policyId={policy.id} days={7} />
        <p className="text-xs text-muted-foreground">
          Events where this policy fired over the last 7 days. Amber =
          shadow-mode blocks (events that <em>would have</em> been blocked if
          enforcement were on). Red = enforce-mode blocks that actually
          stopped the call. Use this to audit before flipping to enforce.
        </p>
      </section>
    </div>
  );
};

export default PolicyDetailPage;
