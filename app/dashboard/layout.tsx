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

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
};

export default DashboardLayout;
