"use client";

// LE composant d'onglets de l'app (style souligné, sobre) — remplace
// les deux langages qui coexistaient (pills sur fond élevé vs tabs
// soulignés de la fiche client). `href` rend un lien, sinon un bouton.

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  href?: string;
  count?: number;
}

export function TabBar({
  items,
  activeKey,
  onSelect,
  className,
}: {
  items: TabItem[];
  activeKey: string;
  onSelect?: (key: string) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex gap-1 border-b border-border", className)}>
      {items.map((item) => {
        const active = item.key === activeKey;
        const inner = (
          <>
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {item.count}
              </span>
            )}
          </>
        );
        const classes = cn(
          "-mb-px border-b-2 px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
          active
            ? "border-primary font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        );
        return item.href ? (
          <Link key={item.key} href={item.href} className={classes}>
            {inner}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item.key)}
            className={classes}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
