import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/login?next=/dashboard');
    }
    throw e;
  }

  // Sprint 15 A.7 belt-and-braces: proxy.ts handles the same redirect at the
  // edge, but server components can still render if someone bypasses middleware
  // (tests, direct RSC invocation). Flag keeps the dashboard locked until
  // onboarding completes.
  if (!ctx.profile_completed) {
    redirect('/onboarding');
  }

  // Name comes from onboarding metadata (first_name + last_name); fall back to
  // the email local-part when metadata is missing so the sidebar never renders
  // blank. The sidebar is a client component — we can't call requireAuth from
  // inside it, so thread the minimal identity here.
  const metadata = (ctx.user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : '';
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = ctx.user.email ?? '';
  const displayName = fullName || email.split('@')[0] || 'Member';

  // Sprint 21 WP-21.2: org name in the site-header brand cluster.
  // requireAuth is React-cache()-wrapped so this query is the only DB hit
  // for org metadata across the layout + page tree.
  const { data: orgRow } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.organization_id)
    .maybeSingle();
  const orgName = typeof orgRow?.name === 'string' ? orgRow.name : undefined;

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={{ name: displayName, email }} />
      <SidebarInset className="border overflow-hidden">
        <SiteHeader orgName={orgName} />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
};

export default DashboardLayout;
