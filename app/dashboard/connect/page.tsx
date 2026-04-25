import { redirect } from 'next/navigation';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { ConnectPanel } from '@/components/dashboard/connect-panel';

export const dynamic = 'force-dynamic';

// Sprint 24 WP-24.1 — self-serve onboarding patch. Without this page, a fresh
// signup who has minted a token + registered an MCP has zero UI for "where do
// I point my client?" Industry pattern (Kong / Apigee / Stripe / Twilio) — every
// API gateway ships a connect/quickstart surface. Three tiers map to the
// existing scoped gateway: org / domain / server. Token plaintext is never
// re-shown (SHA-256 only in DB) — user pastes their own when testing.

type DomainRow = { slug: string; name: string };
type ServerRow = { id: string; name: string; transport: string };
type TokenRow = { id: string; name: string };

const ConnectPage = async () => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/dashboard/connect');
    }
    throw e;
  }

  const { supabase, organization_id } = ctx;

  const [domainsRes, serversRes, tokensRes] = await Promise.all([
    supabase
      .from('domains')
      .select('slug, name')
      .eq('organization_id', organization_id)
      .order('name'),
    supabase
      .from('servers')
      .select('id, name, transport')
      .eq('organization_id', organization_id)
      .order('name'),
    supabase
      .from('gateway_tokens')
      .select('id, name')
      .eq('organization_id', organization_id)
      .eq('kind', 'user')
      .order('created_at', { ascending: false }),
  ]);

  const domains = (domainsRes.data ?? []) as DomainRow[];
  const servers = (serversRes.data ?? []) as ServerRow[];
  const tokens = (tokensRes.data ?? []) as TokenRow[];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Connect</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Point any MCP client at the gateway. Pick a scope, copy the endpoint, drop a snippet
          into your client config.
        </p>
      </header>

      <ConnectPanel domains={domains} servers={servers} tokens={tokens} />
    </div>
  );
};

export default ConnectPage;
