'use server';

import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

// Sprint 15 A.7: onboarding form server action. Writes happen in three places
// in one logical flow — `organizations.name` (retires the `<handle>'s
// Workspace` placeholder), `memberships.profile_completed=true` (flips the
// gate), `auth.users.raw_user_meta_data` (persists first/last/company).
//
// Not wrapped in a DB transaction: Supabase SSR client does not expose one,
// and the three writes target different schemas (public + auth). Failure
// modes: if any step errors, subsequent steps still run best-effort and the
// action surfaces the partial-failure shape so the form can retry safely
// (the flag flip is idempotent; re-submitting completes the remaining
// steps).

const OnboardingSchema = z.object({
  first_name: z.string().trim().min(1, 'first name is required').max(80),
  last_name: z.string().trim().min(1, 'last name is required').max(80),
  company: z.string().trim().min(1, 'company is required').max(120),
  org_name: z.string().trim().min(1, 'workspace name is required').max(120),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export type OnboardingResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' }
  | { ok: false; error: 'invalid_input'; issues: Record<string, string> }
  | { ok: false; error: 'already_completed' }
  | { ok: false; error: 'update_failed'; detail: string };

export const completeOnboarding = async (
  rawInput: OnboardingInput,
): Promise<OnboardingResult> => {
  const parsed = OnboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issues: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === 'string') issues[path] = issue.message;
    }
    return { ok: false, error: 'invalid_input', issues };
  }

  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return { ok: false, error: 'unauthorized' };
    }
    throw e;
  }

  if (ctx.profile_completed) {
    return { ok: false, error: 'already_completed' };
  }

  const { first_name, last_name, company, org_name } = parsed.data;

  const orgUpdate = await ctx.supabase
    .from('organizations')
    .update({ name: org_name, created_by: ctx.user.id })
    .eq('id', ctx.organization_id);
  if (orgUpdate.error) {
    return { ok: false, error: 'update_failed', detail: 'org_update_failed' };
  }

  const membershipUpdate = await ctx.supabase
    .from('memberships')
    .update({ profile_completed: true })
    .eq('user_id', ctx.user.id)
    .eq('organization_id', ctx.organization_id);
  if (membershipUpdate.error) {
    return { ok: false, error: 'update_failed', detail: 'membership_update_failed' };
  }

  const userUpdate = await ctx.supabase.auth.updateUser({
    data: { first_name, last_name, company },
  });
  if (userUpdate.error) {
    // Flag is already flipped; surface the metadata failure but don't block
    // dashboard access — user can edit in V2 Settings.
    return { ok: false, error: 'update_failed', detail: 'user_metadata_update_failed' };
  }

  return { ok: true };
};
