import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { hashToken } from '@/lib/mcp/auth-token';

// Sprint 7 WP-A.6: gateway-token mint UI closes the hosted bootstrap gap -
// a fresh deploy has zero rows in `gateway_tokens`, so every MCP call 401s
// with `invalid_token`. Plaintext is returned ONCE on POST and never again;
// DB stores only the SHA-256 hash (see `hashToken`). All reads are org-scoped
// so cross-org IDs can never surface in list/delete.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  name: z.string().min(1).max(60),
});

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export const GET = async (): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  // Sprint 17 WP-17.2: hide `kind='system'` rows (e.g. Playground's reused
  // internal bearer). User-consented tokens are strictly `kind='user'`; system
  // tokens are infra-owned and never surfaced via the tokens UI.
  const { data, error } = await supabase
    .from('gateway_tokens')
    .select('id, name, last_used_at, created_at')
    .eq('organization_id', organization_id)
    .eq('kind', 'user')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'load failed', details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ tokens: data ?? [] });
};

export const POST = async (request: Request): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 32 random bytes → 64 hex chars. `sgps_` prefix lets operators spot tokens
  // in logs / env files without decoding. Plaintext never persists; we hash
  // and throw away the plaintext after this response.
  const plaintext = `sgps_${randomBytes(32).toString('hex')}`;
  const token_hash = hashToken(plaintext);

  // Sprint 17 WP-17.2: user-facing route always mints `kind='user'`. System
  // tokens are infra-owned and only the Playground's `mintPlaygroundToken`
  // creates them, never through this user-consent surface. Explicit here
  // even though the column default is 'user', so a future default flip can't
  // silently escalate a user-minted token into a hidden system token.
  const { data, error } = await supabase
    .from('gateway_tokens')
    .insert({
      organization_id,
      token_hash,
      name: parsed.data.name,
      kind: 'user',
    })
    .select('id, name, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'create failed', details: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      plaintext,
    },
    { status: 201 },
  );
};
