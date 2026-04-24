import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ActiveOrgSchema = z.object({
  organization_id: z.string().uuid('organization_id must be a valid UUID'),
});

/**
 * PUT /api/user/active-org
 *
 * Switch the authenticated user's active organization. Stores the preference
 * in `raw_user_meta_data.active_org_id`; the custom_access_token_hook reads
 * it on next token refresh and stamps the corresponding org into the JWT.
 *
 * Validates that the user has a membership in the target org before writing.
 * Returns 403 if no membership exists (prevents switching to an org the user
 * was removed from or never belonged to).
 */
export const PUT = async (request: Request) => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = ActiveOrgSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return NextResponse.json({ error: 'invalid_input', issues }, { status: 400 });
  }

  const { organization_id } = parsed.data;

  // Verify the user actually has a membership in the target org.
  const { data: membership, error: memErr } = await ctx.supabase
    .from('memberships')
    .select('id')
    .eq('user_id', ctx.user.id)
    .eq('organization_id', organization_id)
    .maybeSingle();

  if (memErr || !membership) {
    return NextResponse.json(
      { error: 'forbidden', message: 'no membership in the target organization' },
      { status: 403 },
    );
  }

  // Store the preference in user metadata. The custom_access_token_hook
  // reads raw_user_meta_data->>'active_org_id' on every token issuance.
  const { error: updateErr } = await ctx.supabase.auth.updateUser({
    data: { active_org_id: organization_id },
  });

  if (updateErr) {
    return NextResponse.json(
      { error: 'update_failed', message: 'failed to update active organization' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, organization_id });
};
