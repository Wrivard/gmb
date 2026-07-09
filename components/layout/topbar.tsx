"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";

const titles: Record<string, string> = {
  "/": "Aujourd'hui",
  "/reviews": "File reviews",
  "/posts": "File posts",
  "/clients": "Projets",
  "/settings": "Agence",
};

function pageTitle(pathname: string): string {
  if (titles[pathname]) return titles[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return titles[base] ?? "Küa Locale";
}

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur print:hidden">
      <MobileNav />
      <h1 className="text-sm font-medium">{pageTitle(pathname)}</h1>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new Event("kua:open-command-palette"))
        }
        className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5 text-xs text-muted-foreground transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Search className="size-3.5" />
        <span>Rechercher un projet…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
