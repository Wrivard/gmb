// Machine à états des posts — seule source des partitions, labels et
// transitions. Actions, crons et UI interrogent cette interface au lieu
// de porter chacun leur copie des listes de statuts.
//
// Graphe : draft → scheduled → publishing → published
//                     ↑            ↓
//                  failed ─────────┘  (« Réessayer » = re-approuver)
//
// Pas de "server-only" : consommé aussi par les composants client.

import type { PostStatus } from "@/lib/types/database";

/** Statuts encore éditables (texte, CTA, date, image). */
export function isPostEditable(status: PostStatus): boolean {
  return status !== "published" && status !== "publishing";
}

/** Statuts depuis lesquels « Approuver » mène à `scheduled`. */
export function isPostApprovable(status: PostStatus): boolean {
  return status === "draft" || status === "failed";
}

/**
 * Statuts depuis lesquels le verrou optimiste de `publishPost` accepte
 * de passer à `publishing`, selon l'initiateur :
 * - `member` : « Publier maintenant » court-circuite le scheduler;
 * - `cron` : le scheduler ne prend que le planifié échu.
 */
export const PUBLISHABLE_FROM: Record<"member" | "cron", PostStatus[]> = {
  member: ["draft", "scheduled", "failed"],
  cron: ["scheduled"],
};

/**
 * Partition d'affichage de la file — la même que la vue SQL `posts_due`
 * (« planifié » = scheduled | approved | publishing).
 */
export type PostGroup = "brouillon" | "planifie" | "publie" | "echec";

export function postGroup(status: PostStatus): PostGroup {
  switch (status) {
    case "draft":
      return "brouillon";
    case "failed":
      return "echec";
    case "published":
      return "publie";
    case "approved":
    case "scheduled":
    case "publishing":
      return "planifie";
  }
}

export const POST_STATUS_LABELS_FR: Record<PostStatus, string> = {
  draft: "Brouillon",
  approved: "Approuvé",
  scheduled: "Planifié",
  publishing: "Publication…",
  published: "Publié",
  failed: "Échec",
};
