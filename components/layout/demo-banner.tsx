import { Info } from "lucide-react";

/** Affiché au-dessus des pages rendues avec les fixtures de lib/demo.ts. */
export function DemoBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
      <Info className="size-3.5 shrink-0" />
      <span>
        Données d&apos;exemple — Supabase n&apos;est pas configuré. Remplis
        `.env.local` pour brancher les vraies données.
      </span>
    </div>
  );
}
