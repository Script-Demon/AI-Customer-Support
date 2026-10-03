"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, BookOpen, Inbox, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Inbox },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
]

export function NavLinks({ openCount }: { openCount: number }) {
  const pathname = usePathname()
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
            {href === "/tickets" && openCount > 0 && (
              <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground tabular-nums">{openCount}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
