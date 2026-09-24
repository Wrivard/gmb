// Optimisation INITIALE d'une fiche GBP, à l'arrivée d'un client.
//
// Périmètre : les informations de la FICHE. Pas les avis, pas les
// publications — ce sont des flux continus, mesurés par l'état de santé
// (lib/clients/health.ts). Le wizard décrit une tâche qui se termine :
// il doit pouvoir atteindre 100 %.
//
// v2 : les données se
// SAISISSENT dans l'app (clients.gbp_profile) et se poussent vers
// Google via GbpClient; le score se calcule sur les données réelles,
// plus sur des cases cochées. Quelques critères restent manuels par
// nature (cohérence NAP sur les annuaires, entente photos…).
//
// Ordre et poids fondés sur les études de classement local (recherche
// 2026-07-13) : Whitespark Local Search Ranking Factors 2026, études
// Sterling Sky, BrightLocal, guidelines Google.
//
// Pas de "server-only" : consommé aussi par le wizard (client).

import type {
  GbpProfileData,
  GbpWeekday,
  OnboardingState,
} from "@/lib/types/database";

export const WEEKDAYS: Array<{ key: GbpWeekday; label: string }> = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
];

/**
 * Mesures d'avis calculées en base (lib/onboarding/review-stats.ts).
 *
 * Elles ne comptent PLUS dans le score du wizard : celui-ci mesure
 * l'optimisation de la FICHE, une tâche qui se termine. Un nouveau
 * client n'a par construction ni volume d'avis ni flux sur trois mois —
 * les y inclure plafonnait le wizard à 84 % le jour 1 et empêchait
 * l'onboarding d'être jamais « terminé ». Le flux d'avis vit désormais
 * dans l'état de santé (lib/clients/health.ts).
 */
export interface ReviewStats {
  total: number;
  /** Les avis AVEC TEXTE pèsent plus que les étoiles seules (#9, 170). */
  withText: number;
  /** Jours depuis le dernier avis — `null` si aucun avis. */
  daysSinceLastReview: number | null;
  /** Avis sans réponse publiée. */
  unanswered: number;
  /** Mois distincts avec au moins un avis sur les 3 derniers. */
  monthsWithReview: number;
}

/** Contexte d'évaluation du score — tout vient de la ligne clients. */
export interface OnboardingCtx {
  profile: GbpProfileData;
  checks: NonNullable<OnboardingState["items"]>;
  /** Profil de marque (IA) complet — dérivé de brand_profile. */
  brandProfileComplete: boolean;
}

/**
 * Niveau de preuve derrière un critère. Affiché tel quel : une
 * checklist de SEO local mélange des tests contrôlés et des croyances
 * de blogue, et l'équipe mérite de savoir lesquels sont lesquels.
 */
export type Evidence =
  /** Test contrôlé ou position mesurée dans un référentiel. */
  | "prouvé"
  /** Corrélation observée, causalité non établie. */
  | "corrélé"
  /** Pas d'effet sur le classement — conversion, conformité ou hygiène. */
  | "pratique";

export interface Requirement {
  key: string;
  label: string;
  hint?: string;
  /** Cochée à la main (réalité hors app); sinon dérivée des données. */
  manual?: boolean;
  /** L'item se fait DANS l'app : onglet du projet à ouvrir. */
  appTab?: "settings" | "posts";
  /** Critère automatique — vrai quand les données le remplissent. */
  test?: (ctx: OnboardingCtx) => boolean;
  /**
   * Poids 1–5 dans le score. Calé sur les scores individuels du
   * référentiel Whitespark 2026 (catégorie principale 227, ouverture au
   * moment de la recherche 189, adresse affichée 176, avis avec texte
   * 170, récence 164…). Sans poids, « date d'ouverture renseignée »
   * valait autant que « catégorie principale » : un score de 70 % ne
   * disait rien de ce qui manquait vraiment.
   */
  weight: number;
  evidence: Evidence;
  /** D'où vient l'affirmation — pour pouvoir la contester. */
  source?: string;
}

export interface OnboardingStepDef {
  key: string;
  title: string;
  /** L'impact, avec la source — le pitch qui justifie l'étape. */
  why: string;
  /** Section de gbp_profile éditée par l'étape (pushable ou non). */
  section?: PushSection | "qna" | "categories";
  requirements: Requirement[];
}

/** Sections de la fiche pushables vers Google dès maintenant (patch
    Business Information). categories et qna attendent leurs API
    (référentiel de catégories, API Q&A). */
export type PushSection = "identity" | "hours" | "presentation" | "services";

export const PUSHABLE_SECTIONS: PushSection[] = [
  "identity",
  "hours",
  "presentation",
  "services",
];

const filled = (value: string | undefined | null): boolean =>
  Boolean(value && value.trim());

/**
 * Une photo compte, qu'elle vienne de Google ou de l'app.
 *
 * Le wizard ne comptait que les téléversements faits ici : une fiche
 * avec logo, couverture et galerie affichait « 0/10 photos » et
 * réclamait des images déjà en ligne.
 */
function hasRole(ctx: OnboardingCtx, role: "logo" | "cover"): boolean {
  if ((ctx.profile.photos ?? []).some((photo) => photo.role === role)) {
    return true;
  }
  const wanted = role === "logo" ? "PROFILE" : "COVER";
  return (ctx.profile.google_media?.items ?? []).some(
    (item) => item.category === wanted,
  );
}

export function galleryCount(ctx: OnboardingCtx): number {
  const local = (ctx.profile.photos ?? []).filter(
    (photo) => photo.role === "photo",
  ).length;
  const onGoogle = (ctx.profile.google_media?.items ?? []).filter(
    (item) => item.category !== "PROFILE" && item.category !== "COVER",
  ).length;
  return local + onGoogle;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    key: "categories",
    title: "Catégories",
    why: "La catégorie principale est le facteur individuel le plus lourd du classement local (score 227, Whitespark 2026). Sterling Sky a documenté un client passé de la 1re à la 31e place après UN seul changement de catégorie. Aucun autre signal ne compense une mauvaise catégorie.",
    section: "categories",
    requirements: [
      {
        key: "categories.principale",
        label: "Catégorie principale la plus SPÉCIFIQUE possible",
        hint: "« Couvreur » bat « Entrepreneur en construction ». Compare avec les 3 concurrents qui rankent dans le local pack.",
        test: (ctx) => filled(ctx.profile.categories?.primary),
        weight: 5,
        evidence: "prouvé",
        source: "Whitespark 2026 (#1, 227) ; Sterling Sky",
      },
      {
        key: "categories.secondaires",
        label: "Toutes les catégories secondaires pertinentes listées",
        hint: "Chaque service majeur qui a sa catégorie Google — sans exagérer (les non pertinentes diluent).",
        test: (ctx) => (ctx.profile.categories?.additional?.length ?? 0) > 0,
        weight: 4,
        evidence: "prouvé",
        source: "Whitespark 2026 (#8, 173)",
      },
    ],
  },
  {
    key: "identity",
    title: "Identité & coordonnées",
    why: "Quatre des dix premiers facteurs vivent ici : adresse affichée, ouverture au moment de la recherche, placement de l'épingle, cohérence NAP. C'est la strate la plus rentable après la catégorie.",
    section: "identity",
    requirements: [
      {
        key: "identity.nom",
        label: "Nom EXACT de l'entreprise — aucun mot-clé ajouté",
        hint: "« Toitures Bergeron », pas « Toitures Bergeron, couvreur Rive-Nord ». Les mots-clés dans le nom sont le 3e facteur le plus fort (223) ET une infraction : suspension possible. On ne joue pas à ça avec la fiche d'un client.",
        test: (ctx) => filled(ctx.profile.identity?.name),
        weight: 4,
        evidence: "prouvé",
        source: "Whitespark 2026 (#3, 223) ; règles Google",
      },
      {
        key: "identity.adresse",
        label: "Adresse exacte (ou zone de service définie)",
        test: (ctx) => filled(ctx.profile.identity?.address),
        weight: 4,
        evidence: "prouvé",
        source: "Whitespark 2026 (#4, 213)",
      },
      {
        key: "identity.adresse-visible",
        label: "Adresse AFFICHÉE sur la fiche si l'entreprise a des locaux",
        hint: "« Adresse affichée » est le 7e facteur (176), et masquer l'adresse corrèle négativement avec les requêtes « près de moi » (Sterling Sky, 8 186 entreprises). Ne la cache que si Google l'exige.",
        manual: true,
        weight: 4,
        evidence: "prouvé",
        source: "Whitespark 2026 (#7, 176) ; Sterling Sky 2025",
      },
      {
        key: "identity.epingle",
        label: "Épingle de la carte placée précisément sur l'entrée",
        hint: "10e facteur (165) et le plus souvent négligé : glisse l'épingle sur la porte, pas au milieu du bâtiment ou de la rue.",
        manual: true,
        weight: 3,
        evidence: "prouvé",
        source: "Whitespark 2026 (#10, 165)",
      },
      {
        key: "identity.telephone",
        label: "Téléphone local (pas de 1-800)",
        hint: "Le même numéro que sur le site web, format identique.",
        test: (ctx) => filled(ctx.profile.identity?.phone),
        weight: 2,
        evidence: "corrélé",
      },
      {
        key: "identity.siteweb",
        label: "Site web vers la page la PLUS pertinente",
        hint: "Fiche d'une succursale → sa page locale, pas l'accueil. Sterling Sky met en garde : pointer vers une page qui ranke déjà fort peut nuire, les deux se concurrençant.",
        test: (ctx) => filled(ctx.profile.identity?.website),
        weight: 3,
        evidence: "corrélé",
        source: "Sterling Sky",
      },
      {
        key: "identity.heures",
        label: "Heures d'ouverture définies pour les 7 jours",
        hint: "« Ouvert au moment de la recherche » est le 5e facteur (189) : des heures larges et exactes augmentent la fenêtre de visibilité. Ouvert avec plage, ou explicitement fermé — jamais indéfini.",
        test: (ctx) =>
          WEEKDAYS.every(
            (day) => (ctx.profile.hours ?? {})[day.key] !== undefined,
          ),
        weight: 4,
        evidence: "prouvé",
        source: "Whitespark 2026 (#5, 189)",
      },
      {
        key: "identity.heures-speciales",
        label: "Heures spéciales posées pour les congés à venir",
        hint: "Une fiche « ouverte » un 25 décembre alors que c'est fermé, c'est un client devant une porte close — et un avis 1★ mérité.",
        manual: true,
        weight: 2,
        evidence: "pratique",
      },
      {
        key: "identity.nap-coherent",
        label: "NAP vérifié IDENTIQUE sur le site du client et les annuaires",
        hint: "Site, Pages Jaunes, Facebook. 15e facteur (153). Les incohérences se corrigent maintenant, pas « un jour ».",
        manual: true,
        weight: 3,
        evidence: "prouvé",
        source: "Whitespark 2026 (#15, 153)",
      },
    ],
  },
  {
    key: "services",
    title: "Services",
    why: "Sterling Sky a mesuré des mouvements de classement en 24 à 72 h après l'ajout d'un service précis — un des rares leviers à effet rapide et vérifiable.",
    section: "services",
    requirements: [
      {
        key: "services.liste",
        label: "Au moins 3 services listés",
        hint: "Les services que les clients cherchent avec leurs mots (« déneigement de toiture », « inspection par drone »).",
        test: (ctx) =>
          (ctx.profile.services?.filter((s) => filled(s.name)).length ?? 0) >= 3,
        weight: 4,
        evidence: "prouvé",
        source: "Sterling Sky, retest 2022",
      },
      {
        key: "services.predefinis",
        label: "Au moins un service PRÉDÉFINI de Google est retenu",
        hint: "Le test de Sterling Sky portait sur les services prédéfinis, pas sur le texte libre. Coche d'abord ceux que Google propose pour la catégorie, puis complète librement.",
        test: (ctx) =>
          (ctx.profile.services ?? []).some((service) =>
            Boolean(service.service_type_id),
          ),
        weight: 4,
        evidence: "prouvé",
        source: "Sterling Sky, retest 2022",
      },
      {
        key: "services.descriptions",
        label: "Chaque service principal a sa description",
        hint: "2-3 phrases concrètes — utile pour l'utilisateur, du contexte pour Google.",
        test: (ctx) => {
          const services = (ctx.profile.services ?? []).filter((s) =>
            filled(s.name),
          );
          return services.length > 0 && services.every((s) => filled(s.description));
        },
        weight: 2,
        evidence: "pratique",
      },
      {
        key: "services.exhaustif",
        label: "Rien d'important ne manque (validé avec le client)",
        hint: "La liste couvre tout ce que l'entreprise veut vendre — pas juste ce qui nous est venu en tête.",
        manual: true,
        weight: 2,
        evidence: "pratique",
      },
    ],
  },
  {
    key: "presentation",
    title: "Description & présentation",
    why: "Les mots-clés de la description ne font pas ranker. Ce qui se joue ici, c'est la conversion — avec une exception mesurée : les attributs d'identité.",
    section: "presentation",
    requirements: [
      {
        key: "presentation.description",
        label: "Description substantielle (250-750 caractères)",
        hint: "L'essentiel dans les 250 premiers caractères. Pas de promo, pas d'URL, pas de bourrage de mots-clés. Google refuse au-delà de 750 caractères.",
        test: (ctx) => {
          const length = ctx.profile.description?.trim().length ?? 0;
          return length >= 250 && length <= 750;
        },
        weight: 1,
        evidence: "pratique",
        source: "BrightLocal : pas d'effet classement",
      },
      {
        key: "presentation.ouverture",
        label: "Date d'ouverture renseignée",
        hint: "L'ancienneté rassure — Google affiche « 15+ ans en affaires ».",
        test: (ctx) => filled(ctx.profile.opening_date),
        weight: 1,
        evidence: "pratique",
      },
      {
        key: "presentation.attributs-identite",
        label: "Attributs d'identité cochés (entreprise féminine, vétéran…)",
        hint: "Sterling Sky a observé l'apparition de résultats en 3-pack là où il n'y en avait pas. Rare : un attribut déclaratif avec un effet de classement constaté.",
        manual: true,
        weight: 2,
        evidence: "corrélé",
        source: "Sterling Sky",
      },
      {
        key: "presentation.attributs",
        label: "Attributs de service cochés (accessibilité, paiements, RDV…)",
        hint: "Selon la catégorie. Ils alimentent les filtres de Maps : un client qui filtre « accessible en fauteuil roulant » ne voit que les fiches qui l'ont coché.",
        manual: true,
        weight: 2,
        evidence: "pratique",
      },
      {
        key: "presentation.liens-sociaux",
        label: "Liens sociaux renseignés (jusqu'à 5)",
        hint: "Facebook, Instagram, LinkedIn, YouTube, TikTok. Compte dans la complétude de la fiche et Google peut en afficher les publications.",
        manual: true,
        weight: 1,
        evidence: "pratique",
        source: "Sterling Sky, checklist",
      },
    ],
  },
  {
    key: "photos",
    title: "Photos",
    why: "Les signaux d'engagement (photos vues, clics, appels) pèsent de plus en plus (Whitespark). Des vraies photos de terrain — jamais de stock — font la différence à la conversion.",
    requirements: [
      {
        key: "photos.logo-couverture",
        label: "Logo + photo de couverture téléversés",
        hint: "La couverture est la première impression dans Maps. La meilleure photo réelle, pas le logo étiré.",
        test: (ctx) => hasRole(ctx, "logo") && hasRole(ctx, "cover"),
        weight: 2,
        evidence: "pratique",
      },
      {
        key: "photos.lot-initial",
        label: "Minimum 10 vraies photos : extérieur, intérieur, équipe, réalisations",
        hint: "Prises par le client ou l'agence — jamais de stock. Avant/après pour les métiers de la construction.",
        test: (ctx) => galleryCount(ctx) >= 10,
        weight: 2,
        evidence: "pratique",
      },
      {
        key: "photos.cadence",
        label: "Entente avec le client pour recevoir des photos en continu",
        hint: "1-2 photos fraîches par mois valent mieux que 50 photos posées une fois.",
        manual: true,
        weight: 1,
        evidence: "pratique",
      },
    ],
  },
  {
    key: "lancement",
    title: "Lancement",
    why: "Une étude contrôlée de Sterling Sky sur 441 mots-clés et 9 semaines n'a mesuré AUCUN mouvement de classement dû aux posts. On publie pour la conversion et pour nourrir les résumés IA de Maps, pas pour ranker.",
    section: "qna",
    requirements: [
      {
        key: "lancement.qna",
        label: "Au moins 3 questions-réponses rédigées",
        hint: "On pose ses propres questions (soumission ? zone desservie ? garanties ?) et on y répond au nom de l'entreprise.",
        test: (ctx) =>
          (ctx.profile.qna?.filter(
            (pair) => filled(pair.question) && filled(pair.answer),
          ).length ?? 0) >= 3,
        weight: 1,
        evidence: "pratique",
      },
      {
        key: "lancement.profil-marque",
        label: "Profil de marque complété dans l'app (ton, services, arguments)",
        hint: "C'est ce qui nourrit l'IA pour les réponses d'avis et les posts.",
        appTab: "settings",
        test: (ctx) => ctx.brandProfileComplete,
        weight: 1,
        evidence: "pratique",
      },
      {
        key: "lancement.cadence-posts",
        label: "Cadence configurée + premier post généré et approuvé",
        hint: "File posts, une idée de lancement, générer, réviser, approuver. Aucun effet de classement démontré : c'est de la conversion et de la fraîcheur.",
        manual: true,
        appTab: "posts",
        weight: 1,
        evidence: "pratique",
        source: "Sterling Sky : 441 mots-clés, 9 semaines, 0 mouvement",
      },
    ],
  },
];

/** Nombre total de critères. */
export const ONBOARDING_TOTAL = ONBOARDING_STEPS.reduce(
  (sum, step) => sum + step.requirements.length,
  0,
);

export function isRequirementMet(
  requirement: Requirement,
  ctx: OnboardingCtx,
): boolean {
  if (requirement.test) return requirement.test(ctx);
  return Boolean(ctx.checks[requirement.key]?.done);
}

/** Somme des poids — dénominateur du score. */
export const ONBOARDING_WEIGHT_TOTAL = ONBOARDING_STEPS.reduce(
  (sum, step) =>
    sum + step.requirements.reduce((acc, req) => acc + req.weight, 0),
  0,
);

export interface OnboardingProgress {
  /** Critères remplis — un compte, pas un score. */
  done: number;
  total: number;
  /** 0-100 PONDÉRÉ par l'impact réel sur le classement. */
  pct: number;
  complete: boolean;
  /** Étapes dont tous les critères sont remplis. */
  doneSteps: Set<string>;
  /** Ce qui rapporterait le plus maintenant, du plus lourd au moins. */
  nextBest: Requirement[];
}

/**
 * Score pondéré.
 *
 * Avant, chaque critère valait 1/N : « date d'ouverture renseignée »
 * pesait autant que « catégorie principale », qui est à elle seule le
 * premier facteur de classement. Une fiche à 70 % pouvait donc être
 * dans le rouge sur tout ce qui compte. Le compte de critères reste
 * affiché, mais le pourcentage suit l'impact.
 */
export function onboardingProgress(ctx: OnboardingCtx): OnboardingProgress {
  let done = 0;
  let earned = 0;
  const doneSteps = new Set<string>();
  const missing: Requirement[] = [];

  for (const step of ONBOARDING_STEPS) {
    let stepDone = true;
    for (const requirement of step.requirements) {
      if (isRequirementMet(requirement, ctx)) {
        done++;
        earned += requirement.weight;
      } else {
        stepDone = false;
        missing.push(requirement);
      }
    }
    if (stepDone) doneSteps.add(step.key);
  }

  return {
    done,
    total: ONBOARDING_TOTAL,
    pct: Math.round((earned / ONBOARDING_WEIGHT_TOTAL) * 100),
    complete: done === ONBOARDING_TOTAL,
    doneSteps,
    nextBest: missing.sort((a, b) => b.weight - a.weight).slice(0, 3),
  };
}

/** Construit le contexte d'évaluation depuis une ligne clients. */
export function onboardingCtx(client: {
  gbp_profile?: GbpProfileData | null;
  onboarding?: OnboardingState | null;
  /** true si le profil de marque est complet (isBrandProfileIncomplete inversé). */
  brandProfileComplete: boolean;
}): OnboardingCtx {
  return {
    profile: client.gbp_profile ?? {},
    checks: client.onboarding?.items ?? {},
    brandProfileComplete: client.brandProfileComplete,
  };
}

/** Une clé de critère MANUEL connue ? (garde des actions serveur) */
export function isKnownOnboardingItem(key: string): boolean {
  return ONBOARDING_STEPS.some((step) =>
    step.requirements.some((req) => req.manual && req.key === key),
  );
}
