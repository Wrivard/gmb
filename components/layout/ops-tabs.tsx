"use client";

// Onglets du volet Opérations : le tableau (kanban) et les deux files
// de traitement. Un seul chemin vers chaque tâche.

import { usePathname } from "next/navigation";
import { TabBar } from "@/components/ui/tab-bar";

export function OpsTabs() {
  const pathname = usePathname();
  const active = pathname.startsWith("/reviews")
    ? "reviews"
    : pathname.startsWith("/posts")
      ? "posts"
      : "board";

  return (
    <TabBar
      activeKey={active}
      items={[
        { key: "board", label: "Tableau", href: "/" },
        { key: "reviews", label: "File reviews", href: "/reviews" },
        { key: "posts", label: "File posts", href: "/posts" },
      ]}
    />
  );
}
