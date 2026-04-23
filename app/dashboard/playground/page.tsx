import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { PlaygroundWorkbench } from '@/components/dashboard/playground-workbench';

// Sprint 8 WP-J.1: Playground A/B hero page. Side-by-side Opus 4.7 runs
// against two surfaces — left = raw/simulated tools, right = our governed
// gateway. The contrast is the whole demo: relationships, PII policy, and
// rollback only show up on the right.

export const dynamic = 'force-dynamic';

type TokenSummary = { id: string; name: string; created_at: string };

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

  const { data: tokensData } = await supabase
    .from('gateway_tokens')
    .select('id, name, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1);

  const tokens = (tokensData ?? []) as TokenSummary[];
  const hasToken = tokens.length > 0;

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

      {hasToken ? (
        <PlaygroundWorkbench tokenName={tokens[0].name} />
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            The Playground needs a gateway bearer token to reach the governed MCP surface.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mint one on the Tokens page — the plaintext is shown once, so copy it before
            returning here.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/tokens">Create a gateway token</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default PlaygroundPage;
