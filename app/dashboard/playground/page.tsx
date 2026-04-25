import { createClient } from '@/lib/supabase/server';
import { PlaygroundSandboxInfo } from '@/components/dashboard/playground-sandbox-info';
import { PlaygroundWorkbench } from '@/components/dashboard/playground-workbench';

// Playground A/B page. Side-by-side runs of the same prompt — Raw (no
// governance) vs Semantic GPS (full control plane). Server fetches the org's
// MCP servers so the workbench can show the scope picker; the run uses the
// auto-managed system token via `/api/playground/run`.

export const dynamic = 'force-dynamic';

const PlaygroundPage = async () => {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Sign in to use the playground.</div>
    );
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();
  const organizationId = membership?.organization_id as string | undefined;
  if (!organizationId) {
    return <div className="p-6 text-sm text-muted-foreground">No organization membership.</div>;
  }

  const { data: serversData } = await supabase
    .from('servers')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name');

  const servers = (serversData ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="flex flex-col gap-3 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
          <PlaygroundSandboxInfo />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Same prompt · two agents · watch the gateway intercept
        </p>
      </header>

      <PlaygroundWorkbench servers={servers} />
    </div>
  );
};

export default PlaygroundPage;
