import "server-only";

import type { getDb } from "@/lib/supabase/db";
import type { ReviewStats } from "./steps";

// Mesures d'avis pour le score d'optimisation.
//
// Trois des critères les plus lourds du référentiel portent sur les
// avis : volume avec texte, récence, flux soutenu. Ils étaient des cases
// à cocher — donc l'équipe devait compter à la main ce que l'app sait,
// et une case cochée en juillet restait cochée en décembre alors que le
// flux s'était tari. Mesuré, le critère retombe tout seul.

export const RECENCY_DAYS = 21;
export const STREAK_MONTHS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

interface ReviewRow {
  client_id: string;
  comment: string | null;
  review_created_at: string | null;
  status: string;
}

/** Un avis compte comme répondu quand sa réponse est publiée. */
function isAnswered(status: string): boolean {
  return status === "replied";
}

export function aggregate(rows: ReviewRow[], now: number): ReviewStats {
  let withText = 0;
  let unanswered = 0;
  let latest: number | null = null;
  const months = new Set<string>();
  // Fenêtre du flux : les 3 derniers mois calendaires, mois courant
  // inclus. Un avis d'il y a 80 jours ne prouve rien sur aujourd'hui.
  const cutoff = now - STREAK_MONTHS * 31 * DAY_MS;

  for (const row of rows) {
    if (row.comment?.trim()) withText++;
    if (!isAnswered(row.status)) unanswered++;

    if (!row.review_created_at) continue;
    const at = new Date(row.review_created_at).getTime();
    if (Number.isNaN(at)) continue;
    if (latest === null || at > latest) latest = at;
    if (at >= cutoff) {
      const date = new Date(at);
      months.add(`${date.getUTCFullYear()}-${date.getUTCMonth()}`);
    }
  }

  return {
    total: rows.length,
    withText,
    unanswered,
    daysSinceLastReview:
      latest === null ? null : Math.floor((now - latest) / DAY_MS),
    monthsWithReview: months.size,
  };
}

/**
 * Stats par projet, en UNE requête. Les pages de liste affichent le
 * score de chaque projet : une requête par projet aurait rendu la liste
 * quadratique en nombre de clients.
 */
export async function reviewStatsByClient(
  supabase: Awaited<ReturnType<typeof getDb>>,
  clientIds: string[],
  now: number = Date.now(),
): Promise<Map<string, ReviewStats>> {
  const stats = new Map<string, ReviewStats>();
  if (!clientIds.length) return stats;

  const { data } = await supabase
    .from("reviews")
    .select("client_id, comment, review_created_at, status")
    .in("client_id", clientIds);

  const byClient = new Map<string, ReviewRow[]>();
  for (const row of (data ?? []) as ReviewRow[]) {
    const list = byClient.get(row.client_id) ?? [];
    list.push(row);
    byClient.set(row.client_id, list);
  }

  // Un projet sans aucun avis a quand même des stats : zéro partout,
  // ce qui n'est pas la même chose que « pas encore mesuré ».
  for (const clientId of clientIds) {
    stats.set(clientId, aggregate(byClient.get(clientId) ?? [], now));
  }
  return stats;
}
