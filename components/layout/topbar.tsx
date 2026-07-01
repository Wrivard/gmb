"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/reviews": "Reviews",
  "/posts": "Posts",
  "/clients": "Clients",
  "/settings": "Réglages",
};

function pageTitle(pathname: string): string {
  if (titles[pathname]) return titles[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return titles[base] ?? "Küa Locale";
}

export function Topbar() {
  const pathname = usePathname();
  const isMock = process.env.NEXT_PUBLIC_GBP_MODE !== "real";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="text-sm font-medium">{pageTitle(pathname)}</h1>
      {isMock && (
        <Badge
          variant="outline"
          className="border-warning/40 text-warning uppercase tracking-wide"
        >
          Mode démo
        </Badge>
      )}
      <div className="flex-1" />
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-hover"
      >
        <Search className="size-3.5" />
        <span>Rechercher un client…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
