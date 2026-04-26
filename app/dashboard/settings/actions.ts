'use server';

import { z } from 'zod';

import { requireAuth, UnauthorizedError } from '@/lib/auth';

// Sprint 22 WP-22.5: settings server action. Mirrors completeOnboarding's
// pattern (organizations.name + auth.users.raw_user_meta_data) but for
// post-onboarding edits, no profile_completed flip, no JWT refresh needed
// since we don't change any claim that proxy.ts reads.

const SettingsSchema = z.object({
  first_name: z.string().trim().min(1, 'first name is required').max(80),
  last_name: z.string().trim().min(1, 'last name is required').max(80),
  company: z.string().trim().min(1, 'company is required').max(120),
  org_name: z.string().trim().min(1, 'workspace name is required').max(120),
});

export type SettingsInput = z.infer<typeof SettingsSchema>;

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' }
  | { ok: false; error: 'invalid_input'; issues: Record<string, string> }
  | { ok: false; error: 'update_failed'; detail: string };

export const updateSettings = async (rawInput: SettingsInput): Promise<SettingsResult> => {
  const parsed = SettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issues: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === 'string') issues[path] = issue.message;
    }
    return { ok: false, error: 'invalid_input', issues };
  }

  const ctxOrError = await requireAuth().catch((e: unknown) => {
    if (e instanceof UnauthorizedError) return null;
    throw e;
  });
  if (!ctxOrError) {
    return { ok: false, error: 'unauthorized' };
  }
  const ctx = ctxOrError;

  const { first_name, last_name, company, org_name } = parsed.data;

  const orgUpdate = await ctx.supabase
    .from('organizations')
    .update({ name: org_name })
    .eq('id', ctx.organization_id);
  if (orgUpdate.error) {
    return { ok: false, error: 'update_failed', detail: 'org_update_failed' };
  }

  const userUpdate = await ctx.supabase.auth.updateUser({
    data: { first_name, last_name, company },
  });
  if (userUpdate.error) {
    return { ok: false, error: 'update_failed', detail: 'user_metadata_update_failed' };
  }

  return { ok: true };
};
