'use client';

import * as React from 'react';
import {
  ActivityIcon,
  GaugeIcon,
  GitMergeIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

type SessionUser = {
  name: string;
  email: string;
};

// Sprint 21 WP-21.1: 3 grouped sections instead of flat 10-item list.
// Overview = where you check status. Configure = where you set the rules.
// Operate = where you run things and watch what happened.
const data = {
  overview: [{ title: 'Dashboard', url: '/dashboard', icon: LayoutDashboardIcon }],
  configure: [
    { title: 'Servers', url: '/dashboard/servers', icon: GlobeIcon },
    { title: 'Routes', url: '/dashboard/routes', icon: RouteIcon },
    { title: 'Relationships', url: '/dashboard/relationships', icon: GitMergeIcon },
    { title: 'Policies', url: '/dashboard/policies', icon: ShieldCheckIcon },
    { title: 'Tokens', url: '/dashboard/tokens', icon: KeyRoundIcon },
  ],
  operate: [
    { title: 'Playground', url: '/dashboard/playground', icon: SparklesIcon },
    { title: 'Workflow Graph', url: '/dashboard/graph', icon: NetworkIcon },
    { title: 'Monitoring', url: '/dashboard/monitoring', icon: GaugeIcon },
    { title: 'Audit', url: '/dashboard/audit', icon: ActivityIcon },
  ],
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: SessionUser;
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard">
                <NetworkIcon className="size-5!" />
                <span className="text-base font-semibold">Semantic GPS</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Overview" items={data.overview} />
        <NavMain label="Configure" items={data.configure} />
        <NavMain label="Operate" items={data.operate} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
