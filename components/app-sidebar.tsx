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
  PlugZapIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { WorkspaceBadge } from '@/components/workspace-badge';
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

type Workspace = {
  name: string;
};

// Sections mirror the customer journey: see status (Overview) → build the
// stack (Build, in step order: connect → relate → routify) → govern at the
// gateway plane (Governance, Kong/Mulesoft model) → run + observe (Operate).
const data = {
  overview: [{ title: 'Dashboard', url: '/dashboard', icon: LayoutDashboardIcon }],
  build: [
    { title: 'MCP Servers', url: '/dashboard/servers', icon: GlobeIcon },
    { title: 'Relationships', url: '/dashboard/relationships', icon: GitMergeIcon },
    { title: 'Routes', url: '/dashboard/routes', icon: RouteIcon },
    { title: 'Tokens', url: '/dashboard/tokens', icon: KeyRoundIcon },
    { title: 'Connect', url: '/dashboard/connect', icon: PlugZapIcon },
  ],
  governance: [
    { title: 'Policies', url: '/dashboard/policies', icon: ShieldCheckIcon },
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
  workspace: Workspace;
};

export function AppSidebar({ user, workspace, ...props }: AppSidebarProps) {
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
        <WorkspaceBadge orgName={workspace.name} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Overview" items={data.overview} />
        <NavMain label="Build" items={data.build} />
        <NavMain label="Governance" items={data.governance} />
        <NavMain label="Operate" items={data.operate} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
