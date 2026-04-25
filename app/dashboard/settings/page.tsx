import { redirect } from 'next/navigation';

import { SettingsForm } from '@/components/dashboard/settings-form';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

// Sprint 22 WP-22.5: profile + workspace settings. Reads existing values
// from auth.users.raw_user_meta_data (first_name, last_name, company) and
// organizations.name; the form delegates to the updateSettings server action.

export const dynamic = 'force-dynamic';

const SettingsPage = async () => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/dashboard/settings');
    }
    throw e;
  }
  const { supabase, organization_id, user } = ctx;

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organization_id)
    .maybeSingle();

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const initial = {
    first_name: typeof metadata.first_name === 'string' ? metadata.first_name : '',
    last_name: typeof metadata.last_name === 'string' ? metadata.last_name : '',
    company: typeof metadata.company === 'string' ? metadata.company : '',
    org_name: org?.name ?? '',
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name, company, and workspace name. Email and password changes ship in V2.
        </p>
      </header>
      <SettingsForm initial={initial} email={user.email ?? ''} />
    </div>
  );
};

export default SettingsPage;
