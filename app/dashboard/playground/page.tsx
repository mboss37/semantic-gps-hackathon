import { createClient } from '@/lib/supabase/server';
import { PlaygroundWorkbench } from '@/components/dashboard/playground-workbench';

// Sprint 8 WP-J.1: Playground A/B hero page. Side-by-side Opus 4.7 runs
// against two surfaces — left = raw/simulated tools, right = our governed
// gateway. The contrast is the whole demo: relationships, PII policy, and
// rollback only show up on the right.
//
// Sprint 17 WP-17.2: the Playground no longer relies on a user-minted gateway
// token. `/api/playground/run` mints (or reuses) a single org-owned
// `kind='system'` token internally — the user's consent surface for tokens is
// exclusively `/dashboard/tokens`. This page accordingly drops the
// "mint a token first" gate.
//
// Sprint 17 WP-17.3: instead we gate on "at least one MCP server registered",
// since without servers the governed pane returns an empty manifest and the
// model responds text-only. The gate itself lives inside `PlaygroundWorkbench`
// so the busy/empty-prompt states can render consistently.

export const dynamic = 'force-dynamic';

const SYSTEM_TOKEN_DISPLAY_NAME = 'playground-internal';

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

  const { count: serverCount } = await supabase
    .from('servers')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);
  const hasServers = (serverCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Playground</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Same prompt, two agents. Left runs Claude Opus 4.7 against a minimal raw tool set
            with no governance. Right routes through Semantic GPS with policies, relationships,
            and rollback. Watch what the gateway catches.
          </p>
        </div>
      </header>

      <PlaygroundWorkbench
        tokenName={SYSTEM_TOKEN_DISPLAY_NAME}
        hasServers={hasServers}
      />
    </div>
  );
};

export default PlaygroundPage;
