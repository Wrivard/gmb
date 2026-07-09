"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/user-menu";

// Deux volets : Opérations (quoi faire aujourd'hui) et Long terme
// (comment va chaque projet). Les files Reviews/Posts vivent en onglets
// d'Aujourd'hui — plus d'entrées de nav qui se recouvrent.
// Exporté pour le menu mobile (components/layout/mobile-nav.tsx) : une
// seule source de vérité pour la nav.
export const NAV_SECTIONS = [
  {
    label: "Opérations",
    items: [{ href: "/", label: "Aujourd'hui", icon: LayoutDashboard }],
  },
  {
    label: "Long terme",
    items: [
      { href: "/clients", label: "Projets", icon: FolderKanban },
      { href: "/settings", label: "Agence", icon: Building2 },
    ],
  },
] as const;

/** Actif si la route de l'item couvre le pathname (Aujourd'hui englobe les files). */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return (
      pathname === "/" ||
      pathname.startsWith("/reviews") ||
      pathname.startsWith("/posts")
    );
  }
  return pathname.startsWith(href);
}

export function Sidebar({
  userEmail,
  userRole,
  pendingReviews = 0,
  postsDue = 0,
}: {
  userEmail: string | null;
  userRole: string | null;
  pendingReviews?: number;
  postsDue?: number;
}) {
  const pathname = usePathname();
  const isMock = process.env.NEXT_PUBLIC_GBP_MODE !== "real";
  const todo = pendingReviews + postsDue;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary font-bold text-sm text-primary-foreground">
          K
        </span>
        <span className="font-semibold tracking-tight">Küa Locale</span>
      </div>

      <nav className="flex flex-1 flex-col gap-4 px-3 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {section.label}
            </p>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "bg-hover text-foreground"
                      : "text-muted-foreground hover:bg-hover/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="flex-1">{label}</span>
                  {href === "/" && todo > 0 && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary tabular-nums">
                      {todo}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        {isMock && (
          <p className="flex items-center gap-1.5 px-3 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-warning" />
            mode démo — données simulées
          </p>
        )}
        <UserMenu email={userEmail} role={userRole} />
      </div>
    </aside>
  );
}
