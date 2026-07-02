"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Rafraîchit la page quand `reviews` ou `posts` changent côté serveur
 * (cron sync, collègue qui publie) — specs/08 §Temps réel.
 */
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("board-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        scheduleRefresh,
      )
      .subscribe();

    function scheduleRefresh() {
      // Débounce : un sync peut toucher des dizaines de lignes d'un coup.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    }

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
