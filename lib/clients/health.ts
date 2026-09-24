import type { ReviewStats } from "@/lib/onboarding/review-stats";

// État de santé d'un projet — trois piliers, une seule lecture.
//
// À ne pas confondre avec le score du wizard : celui-ci mesure
// l'optimisation INITIALE de la fiche, une tâche qui se termine à 100 %.
// La santé, elle, ne se termine jamais : une fiche parfaitement montée
// en janvier peut être en mauvaise santé en mars parce que les avis se
// sont taris. Mélanger les deux plafonnait le wizard à 84 % le jour de
// l'arrivée d'un client, pour des critères qu'il était impossible de
// remplir ce jour-là.
//
// Pas de "server-only" : calcul pur, testé sans réseau.

/** Ce que la fiche a publié récemment. */
export interface PostStats {
  /** Posts publiés dans les 30 derniers jours. */
  publishedLast30: number;
  /** Publications en échec qui attendent une reprise. */
  failed: number;
  /** Cadence convenue au mandat (`clients.posts_per_month`). */
  monthlyTarget: number;
}

export type HealthStatus = "ok" | "warn" | "critical";

export interface HealthPillar {
  key: "fiche" | "avis" | "posts";
  label: string;
  /** 0-100. */
  pct: number;
  status: HealthStatus;
  /** Une phrase qui dit quoi faire, pas juste ce qui ne va pas. */
  detail: string;
}

export interface ClientHealth {
  pct: number;
  status: HealthStatus;
  pillars: HealthPillar[];
  /** Le pilier le plus abîmé — par quoi commencer. */
  worst: HealthPillar;
}

/**
 * Poids entre piliers.
 *
 * Calés sur le référentiel Whitespark 2026 : les signaux de fiche pèsent
 * ~25-28 % du classement local, les avis ~16-20 %. Les posts n'ont AUCUN
 * effet de classement démontré (Sterling Sky : 441 mots-clés, 9 semaines,
 * zéro mouvement) — ils comptent peu, mais pas zéro : c'est la cadence
 * que le client paie, et une file en échec est un problème réel.
 */
export const HEALTH_WEIGHTS = { fiche: 45, avis: 40, posts: 15 } as const;

function statusFor(pct: number): HealthStatus {
  if (pct >= 80) return "ok";
  if (pct >= 50) return "warn";
  return "critical";
}

/**
 * Santé des avis : quatre mesures, pondérées par ce qui compte au
 * classement. La récence et le flux priment sur le volume — trente avis
 * d'un coup puis plus rien vaut moins qu'un filet régulier.
 */
function reviewPillar(reviews: ReviewStats | undefined): HealthPillar {
  if (!reviews) {
    return {
      key: "avis",
      label: "Avis",
      pct: 0,
      status: "critical",
      detail: "Aucune synchronisation — le projet est-il actif ?",
    };
  }

  const volume = reviews.withText >= 10 ? 1 : reviews.withText / 10;
  const recent =
    reviews.daysSinceLastReview !== null && reviews.daysSinceLastReview <= 21
      ? 1
      : 0;
  const flow = Math.min(reviews.monthsWithReview, 3) / 3;
  const answered =
    reviews.total === 0 ? 0 : 1 - reviews.unanswered / reviews.total;

  const pct = Math.round(
    (volume * 25 + recent * 30 + flow * 30 + answered * 15),
  );

  let detail: string;
  if (reviews.total === 0) {
    detail = "Aucun avis — c'est le premier levier à activer.";
  } else if (reviews.daysSinceLastReview === null) {
    detail = `${reviews.total} avis, aucun daté.`;
  } else if (reviews.daysSinceLastReview > 21) {
    detail = `Aucun nouvel avis depuis ${reviews.daysSinceLastReview} jours — au-delà de 3 semaines, le classement recule.`;
  } else if (reviews.unanswered > 0) {
    detail = `${reviews.unanswered} avis sans réponse.`;
  } else {
    detail = `${reviews.withText} avis avec texte, le dernier il y a ${reviews.daysSinceLastReview} jours.`;
  }

  return { key: "avis", label: "Avis", pct, status: statusFor(pct), detail };
}

function postPillar(posts: PostStats): HealthPillar {
  // Pas de cadence au mandat : le pilier ne peut pas être « en retard ».
  if (posts.monthlyTarget <= 0) {
    return {
      key: "posts",
      label: "Publications",
      pct: 100,
      status: "ok",
      detail: "Aucune cadence au mandat.",
    };
  }

  const done = Math.min(posts.publishedLast30 / posts.monthlyTarget, 1);
  // Un échec de publication compte double : il est passé inaperçu.
  const penalty = posts.failed > 0 ? 40 : 0;
  const pct = Math.max(0, Math.round(done * 100) - penalty);

  const detail = posts.failed
    ? `${posts.failed} publication${posts.failed > 1 ? "s" : ""} en échec à reprendre.`
    : `${posts.publishedLast30}/${posts.monthlyTarget} publiés sur 30 jours.`;

  return {
    key: "posts",
    label: "Publications",
    pct,
    status: statusFor(pct),
    detail,
  };
}

export function clientHealth(input: {
  /** Score pondéré du wizard — l'optimisation de la fiche. */
  onboardingPct: number;
  reviews?: ReviewStats;
  posts: PostStats;
}): ClientHealth {
  const fiche: HealthPillar = {
    key: "fiche",
    label: "Fiche",
    pct: Math.max(0, Math.min(100, Math.round(input.onboardingPct))),
    status: statusFor(input.onboardingPct),
    detail:
      input.onboardingPct >= 100
        ? "Optimisation initiale complète."
        : `Optimisation à ${Math.round(input.onboardingPct)} % — ouvre le wizard.`,
  };

  const pillars = [fiche, reviewPillar(input.reviews), postPillar(input.posts)];
  const pct = Math.round(
    pillars.reduce(
      (sum, pillar) => sum + pillar.pct * HEALTH_WEIGHTS[pillar.key],
      0,
    ) /
      (HEALTH_WEIGHTS.fiche + HEALTH_WEIGHTS.avis + HEALTH_WEIGHTS.posts),
  );

  // Le pire pilier, à poids égal : on veut savoir par où commencer, et
  // un pilier léger qui s'effondre reste un problème à nommer.
  const worst = pillars.reduce((a, b) => (b.pct < a.pct ? b : a));

  // Une moyenne pondérée peut afficher « en santé » alors qu'un pilier
  // est à terre : fiche parfaite + aucun avis depuis 45 jours donnait
  // pile 80 %, donc vert. Règle : l'ensemble ne vaut jamais mieux que
  // son pire pilier. Pas de seuil magique, et rien ne se noie dans la
  // moyenne.
  const RANK: HealthStatus[] = ["ok", "warn", "critical"];
  const byAverage = statusFor(pct);
  const status = RANK.reduce((acc, candidate) =>
    RANK.indexOf(candidate) > RANK.indexOf(acc) &&
    (candidate === byAverage || pillars.some((p) => p.status === candidate))
      ? candidate
      : acc,
  );

  return { pct, status, pillars, worst };
}
