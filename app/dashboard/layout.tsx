import { redirect } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { requireAuth, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      redirect('/api/auth/dev-login?next=/dashboard');
    }
    throw e;
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
