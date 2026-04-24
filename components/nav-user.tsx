"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon, MoreVerticalIcon } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

// Shipped as part of the onboarding wizard fallout (Sprint 15 A.7). The
// earlier shadcn-dashboard-01 boilerplate hardcoded "Demo User" with Account/
// Billing/Notifications placeholders that did nothing. Rebuilt as a real
// session-aware menu: name + email come from the layout (read via
// requireAuth), Log out POSTs to the existing /api/auth/logout route that
// `signOut`s the Supabase session + 303s to /login.

type NavUserProps = {
  user: {
    name: string
    email: string
  }
}

const initialsOf = (name: string, email: string): string => {
  const fromName = name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .trim()
  const source = fromName || email.split("@")[0] || "?"
  return source.slice(0, 2).toUpperCase()
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const initials = initialsOf(user.name, user.email)

  const handleLogout = () => {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch("/api/auth/logout", {
          method: "POST",
          redirect: "manual",
        })
        // 303 redirect lands opaque on fetch; navigate client-side instead.
        if (res.type === "opaqueredirect" || res.ok || res.status === 303) {
          router.push("/login")
          router.refresh()
          return
        }
        setError(`logout_failed_${res.status}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "logout_failed")
      }
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src="" alt={user.name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src="" alt={user.name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={pending}>
              <LogOutIcon />
              {pending ? "Signing out…" : "Log out"}
            </DropdownMenuItem>
            {error ? (
              <span className="block px-2 py-1 text-xs text-destructive">
                {error}
              </span>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
