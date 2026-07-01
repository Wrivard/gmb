"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/posts", label: "Posts", icon: Megaphone },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Réglages", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary font-bold text-sm text-primary-foreground">
          K
        </span>
        <span className="font-semibold tracking-tight">Küa Locale</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-hover text-foreground"
                  : "text-muted-foreground hover:bg-hover/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-hover text-xs text-muted-foreground">
            ?
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">Non connecté</p>
            <p className="truncate text-xs text-muted-foreground">
              Auth en phase 1
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
