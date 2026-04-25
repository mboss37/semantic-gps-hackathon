import { createClient } from '@/lib/supabase/server';
import { GatewayTokenCreateDialog } from '@/components/dashboard/gateway-token-create-dialog';
import { GatewayTokenRow } from '@/components/dashboard/gateway-token-row';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

// Sprint 7 WP-A.6: tokens dashboard. Plaintext is returned ONLY by the POST
// response and surfaced once in the create dialog — we never store or display
// it again. The list here is intentionally minimal (name + timestamps) so a
// shoulder-surfer can't reconstruct anything useful.

type TokenRecord = {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

const TokensPage = async () => {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return <div className="p-6 text-sm text-muted-foreground">Sign in to manage tokens.</div>;
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

  // Sprint 17 WP-17.2: system tokens (e.g. Playground's reused internal
  // bearer) are infra-owned and never user-created. Hide them here so the
  // user's consent surface is strictly the tokens they minted themselves via
  // the Create dialog. Matches the `kind='user'` filter on GET /api/gateway-tokens.
  const { data: tokensData } = await supabase
    .from('gateway_tokens')
    .select('id, name, last_used_at, created_at')
    .eq('organization_id', organizationId)
    .eq('kind', 'user')
    .order('created_at', { ascending: false });

  const tokens = (tokensData ?? []) as TokenRecord[];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gateway tokens</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bearer credentials your MCP clients present in the{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization</code> header.
            Each token&apos;s plaintext value is shown <span className="text-foreground">once</span>{' '}
            on creation. Store it in your secrets manager before closing the dialog.
          </p>
        </div>
        <GatewayTokenCreateDialog />
      </header>

      {tokens.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first token to authenticate MCP clients against the gateway.
          </p>
          <div className="mt-4 inline-flex">
            <GatewayTokenCreateDialog triggerLabel="Create your first token" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <GatewayTokenRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  lastUsedAt={t.last_used_at}
                  createdAt={t.created_at}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TokensPage;
