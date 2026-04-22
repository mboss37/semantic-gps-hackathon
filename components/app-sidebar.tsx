"use client"

import * as React from "react"
import {
  ActivityIcon,
  GitMergeIcon,
  GlobeIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Demo User",
    email: "demo@semantic-gps.dev",
    avatar: "",
  },
  navMain: [
    { title: "Overview", url: "/dashboard", icon: LayoutDashboardIcon },
    { title: "Servers", url: "/dashboard/servers", icon: GlobeIcon },
    { title: "Workflow Graph", url: "/dashboard/graph", icon: NetworkIcon },
    { title: "Relationships", url: "/dashboard/relationships", icon: GitMergeIcon },
    { title: "Policies", url: "/dashboard/policies", icon: ShieldCheckIcon },
    { title: "Audit", url: "/dashboard/audit", icon: ActivityIcon },
  ],
  navSecondary: [
    { title: "Settings", url: "#", icon: SettingsIcon },
    { title: "Help", url: "#", icon: HelpCircleIcon },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
