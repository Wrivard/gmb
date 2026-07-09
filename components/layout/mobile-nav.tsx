"use client";

// Nav mobile (<lg) : la sidebar est cachée, un burger dans la topbar
// ouvre la même nav en panneau latéral. Même source (NAV_SECTIONS).

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_SECTIONS, isNavActive } from "@/components/layout/sidebar";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Ferme le panneau dès que la navigation aboutit.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Ouvrir le menu" />
          }
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                K
              </span>
              Küa Locale
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-4 px-2">
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
                      <Icon className="size-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
