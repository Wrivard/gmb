import "server-only";

// Croissance long terme d'un projet — le requêteur qui alimente
// l'onglet Croissance : évolution de la note, volume de reviews,
// taux/délai de réponse, couverture de la cadence par mois.
// Sans Supabase configuré : adapter démo (lib/demo.ts), même interface.

import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { demoClientGrowth } from "@/lib/demo";
import { torontoInstant, torontoParts } from "@/lib/due";

export interface GrowthMonth {
  key: string; // "2026-02"
  label: string; // "févr."
  reviews: number;
  /** Note moyenne cumulée à la fin du mois (null si aucune review). */
  avgCumulative: number | null;
  postsPublished: number;
  postsTarget: number;
}

export interface ClientGrowth {
  /** 6 mois, chronologiques (le dernier = mois courant, partiel). */
  months: GrowthMonth[];
  avgRating: number | null;
  /** Delta de la note vs la fin du 1er mois de la fenêtre. */
  avgDelta6m: number | null;
  responseRate: { replied: number; total: number } | null;
  medianResponseHours: number | null;
}

const MONTH_LABELS_FR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Bornes UTC des 6 derniers mois de Toronto, chronologiques. */
function monthWindows(now: Date) {
  const { year, month } = torontoParts(now);
  const windows: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
  }> = [];
  for (let offset = 5; offset >= 0; offset--) {
    const m = month - offset;
    const y = m <= 0 ? year - 1 : year;
    const mm = m <= 0 ? m + 12 : m;
    const nextY = mm === 12 ? y + 1 : y;
    const nextM = mm === 12 ? 1 : mm + 1;
    windows.push({
      key: `${y}-${String(mm).padStart(2, "0")}`,
      label: MONTH_LABELS_FR[mm - 1],
      start: torontoInstant(y, mm, 1),
      end: torontoInstant(nextY, nextM, 1),
    });
  }
  return windows;
}

export async function loadClientGrowth(
  client: { id: string; posts_per_month: number },
  now: Date = new Date(),
): Promise<ClientGrowth> {
  if (!supabaseConfigured()) {
    return demoClientGrowth();
  }

  const supabase = await getDb();
  const [{ data: reviews }, { data: posts }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, star_rating, review_created_at, status")
      .eq("client_id", client.id),
    supabase
      .from("posts")
      .select("status, published_at")
      .eq("client_id", client.id),
  ]);

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("review_id, published_at")
        .in("review_id", reviewIds)
    : { data: [] };
  const publishedAtByReview = new Map(
    (replies ?? [])
      .filter((r) => r.published_at)
      .map((r) => [r.review_id, r.published_at as string]),
  );

  const windows = monthWindows(now);
  // NB : posts_per_month est la cadence ACTUELLE — approximation honnête
  // pour les mois passés (l'historique de cadence n'est pas versionné).
  const months: GrowthMonth[] = windows.map((window) => {
    const inWindow = (iso: string | null) =>
      Boolean(
        iso && new Date(iso) >= window.start && new Date(iso) < window.end,
      );
    const upToEnd = (reviews ?? []).filter(
      (r) => new Date(r.review_created_at) < window.end,
    );
    return {
      key: window.key,
      label: window.label,
      reviews: (reviews ?? []).filter((r) => inWindow(r.review_created_at))
        .length,
      avgCumulative: upToEnd.length
        ? round1(
            upToEnd.reduce((sum, r) => sum + r.star_rating, 0) /
              upToEnd.length,
          )
        : null,
      postsPublished: (posts ?? []).filter(
        (p) => p.status === "published" && inWindow(p.published_at),
      ).length,
      postsTarget: client.posts_per_month,
    };
  });

  const first = months[0]?.avgCumulative ?? null;
  const last = months.at(-1)?.avgCumulative ?? null;

  const nonIgnored = (reviews ?? []).filter((r) => r.status !== "ignored");
  const replied = nonIgnored.filter((r) => publishedAtByReview.has(r.id));
  const delays = replied
    .map(
      (r) =>
        (new Date(publishedAtByReview.get(r.id)!).getTime() -
          new Date(r.review_created_at).getTime()) /
        3600_000,
    )
    .filter((h) => h >= 0);

  return {
    months,
    avgRating: last,
    avgDelta6m: first !== null && last !== null ? round1(last - first) : null,
    responseRate: nonIgnored.length
      ? { replied: replied.length, total: nonIgnored.length }
      : null,
    medianResponseHours:
      delays.length > 0 ? Math.round(median(delays) ?? 0) : null,
  };
}
