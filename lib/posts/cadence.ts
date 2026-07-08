// Comptage de la cadence mensuelle — possède « qu'est-ce qui compte
// comme publié / planifié / brouillon ce mois-ci » (mois de Toronto).
// Ce tri était re-dérivé inline à 4 endroits; la vue SQL `posts_due`
// (décision #5) reste la 5e copie, côté base — même partition.
//
// Pas de "server-only" : fonctions pures, testées en vitest.

import { isLate, remainingPosts, torontoMonthRange } from "@/lib/due";
import type { PostStatus } from "@/lib/types/database";

export interface CadencePostRow {
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
}

export interface MonthlyCadence {
  /** Publiés ce mois (published_at dans le mois). */
  published: number;
  /** Planifiés/approuvés ce mois (scheduled_for dans le mois). */
  scheduled: number;
  /** Brouillons datés ce mois. */
  drafts: number;
  /** restants = max(0, cadence − publiés − planifiés). */
  remaining: number;
  /** Passé le 20 du mois avec restants > 0. */
  late: boolean;
}

/** Testeur « cet ISO tombe dans le mois courant de Toronto ». */
export function torontoMonthTester(now: Date): (iso: string | null) => boolean {
  const range = torontoMonthRange(now);
  return (iso) =>
    Boolean(iso && new Date(iso) >= range.start && new Date(iso) < range.end);
}

export function monthlyCadence(
  posts: CadencePostRow[],
  postsPerMonth: number,
  now: Date = new Date(),
): MonthlyCadence {
  const inMonth = torontoMonthTester(now);

  const published = posts.filter(
    (p) => p.status === "published" && inMonth(p.published_at),
  ).length;
  const scheduled = posts.filter(
    (p) =>
      (p.status === "scheduled" || p.status === "approved") &&
      inMonth(p.scheduled_for),
  ).length;
  const drafts = posts.filter(
    (p) => p.status === "draft" && inMonth(p.scheduled_for),
  ).length;

  const remaining = remainingPosts({
    postsPerMonth,
    publishedThisMonth: published,
    scheduledThisMonth: scheduled,
  });

  return {
    published,
    scheduled,
    drafts,
    remaining,
    late: isLate(now, remaining),
  };
}
