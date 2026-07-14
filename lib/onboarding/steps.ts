// Optimisation d'une fiche GBP à l'onboarding — v2 : les données se
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

/** Contexte d'évaluation du score — tout vient de la ligne clients. */
export interface OnboardingCtx {
  profile: GbpProfileData;
  checks: NonNullable<OnboardingState["items"]>;
  /** Profil de marque (IA) complet — dérivé de brand_profile. */
  brandProfileComplete: boolean;
}

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

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    key: "categories",
    title: "Catégories",
    why: "La catégorie principale est LE premier facteur de classement local (32 % du poids, Whitespark 2026). Deux minutes ici valent plus que tout le reste.",
    section: "categories",
    requirements: [
      {
        key: "categories.principale",
        label: "Catégorie principale la plus SPÉCIFIQUE possible",
        hint: "« Couvreur » bat « Entrepreneur en construction ». Compare avec les 3 concurrents qui rankent dans le local pack.",
        test: (ctx) => filled(ctx.profile.categories?.primary),
      },
      {
        key: "categories.secondaires",
        label: "Toutes les catégories secondaires pertinentes listées",
        hint: "Chaque service majeur qui a sa catégorie Google — sans exagérer (les non pertinentes diluent).",
        test: (ctx) => (ctx.profile.categories?.additional?.length ?? 0) > 0,
      },
    ],
  },
  {
    key: "identity",
    title: "Identité & coordonnées",
    why: "Un NAP cohérent partout = +40 % de chances d'apparaître dans le local pack (BrightLocal). Et un nom farci de mots-clés = risque de suspension de la fiche.",
    section: "identity",
    requirements: [
      {
        key: "identity.nom",
        label: "Nom EXACT de l'entreprise — aucun mot-clé ajouté",
        hint: "« Toitures Bergeron », pas « Toitures Bergeron | Couvreur Rive-Nord ». Ça ranke mieux mais c'est interdit : suspension possible.",
        test: (ctx) => filled(ctx.profile.identity?.name),
      },
      {
        key: "identity.adresse",
        label: "Adresse exacte (ou zone de service définie)",
        hint: "Cacher l'adresse corrèle négativement avec le classement « near me » (Sterling Sky 2025) — affiche-la si permis.",
        test: (ctx) => filled(ctx.profile.identity?.address),
      },
      {
        key: "identity.telephone",
        label: "Téléphone local (pas de 1-800)",
        hint: "Le même numéro que sur le site web, format identique.",
        test: (ctx) => filled(ctx.profile.identity?.phone),
      },
      {
        key: "identity.siteweb",
        label: "Site web vers la bonne page",
        hint: "Fiche d'une succursale → sa page locale, pas l'accueil générique.",
        test: (ctx) => filled(ctx.profile.identity?.website),
      },
      {
        key: "identity.heures",
        label: "Heures d'ouverture définies pour les 7 jours",
        hint: "Ouvert avec plage horaire, ou explicitement fermé — jamais indéfini.",
        test: (ctx) =>
          WEEKDAYS.every(
            (day) => (ctx.profile.hours ?? {})[day.key] !== undefined,
          ),
      },
      {
        key: "identity.nap-coherent",
        label: "NAP vérifié IDENTIQUE sur le site du client et les annuaires",
        hint: "Site, Pages Jaunes, Facebook. Les incohérences se corrigent maintenant, pas « un jour ».",
        manual: true,
      },
    ],
  },
  {
    key: "services",
    title: "Services",
    why: "Ajouter les services améliore le classement sur les mots-clés de service (retest Sterling Sky 2022) — surtout quand le service est explicitement cherché.",
    section: "services",
    requirements: [
      {
        key: "services.liste",
        label: "Au moins 3 services listés",
        hint: "Les services que les clients cherchent avec leurs mots (« déneigement de toiture », « inspection par drone »).",
        test: (ctx) =>
          (ctx.profile.services?.filter((s) => filled(s.name)).length ?? 0) >=
          3,
      },
      {
        key: "services.descriptions",
        label: "Chaque service principal a sa description",
        hint: "2-3 phrases concrètes — utile pour l'utilisateur, du contexte pour Google.",
        test: (ctx) => {
          const services = (ctx.profile.services ?? []).filter((s) =>
            filled(s.name),
          );
          return (
            services.length > 0 &&
            services.every((s) => filled(s.description))
          );
        },
      },
      {
        key: "services.exhaustif",
        label: "Rien d'important ne manque (validé avec le client)",
        hint: "La liste couvre tout ce que l'entreprise veut vendre — pas juste ce qui nous est venu en tête.",
        manual: true,
      },
    ],
  },
  {
    key: "presentation",
    title: "Description & présentation",
    why: "Peu d'impact direct sur le classement (les mots-clés de la description ne rankent pas — BrightLocal), mais c'est ce que lit un humain qui hésite : ça se joue à la conversion.",
    section: "presentation",
    requirements: [
      {
        key: "presentation.description",
        label: "Description substantielle (250-750 caractères)",
        hint: "L'essentiel dans les 250 premiers caractères. Pas de promo, pas d'URL, pas de bourrage de mots-clés.",
        test: (ctx) => (ctx.profile.description?.trim().length ?? 0) >= 250,
      },
      {
        key: "presentation.ouverture",
        label: "Date d'ouverture renseignée",
        hint: "L'ancienneté rassure — Google affiche « 15+ ans en affaires ».",
        test: (ctx) => filled(ctx.profile.opening_date),
      },
      {
        key: "presentation.attributs",
        label: "Attributs cochés sur la fiche Google",
        hint: "Accessibilité, paiements, rendez-vous requis… selon la catégorie. (Se fait sur Google — l'API des attributs viendra.)",
        manual: true,
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
        label: "Logo + photo de couverture posés sur la fiche",
        hint: "La couverture = la première impression dans Maps. La meilleure photo réelle, pas le logo étiré.",
        manual: true,
      },
      {
        key: "photos.lot-initial",
        label: "Minimum 10 vraies photos : extérieur, intérieur, équipe, réalisations",
        hint: "Prises par le client ou l'agence. Avant/après pour les métiers de la construction. (L'upload direct depuis l'app viendra avec l'API média.)",
        manual: true,
      },
      {
        key: "photos.cadence",
        label: "Entente avec le client pour recevoir des photos en continu",
        hint: "1-2 photos fraîches par mois > 50 photos posées une fois.",
        manual: true,
      },
    ],
  },
  {
    key: "avis",
    title: "Avis",
    why: "20 % du classement local et en croissance (Whitespark 2026). La RÉCENCE bat le volume, les avis AVEC TEXTE battent les étoiles seules, et les 10 premiers avis débloquent un palier (Sterling Sky).",
    requirements: [
      {
        key: "avis.lien",
        label: "Lien court « laissez-nous un avis » remis au client",
        hint: "Depuis la fiche : Demander des avis → copier le lien. Le client le met dans ses courriels/factures.",
        manual: true,
      },
      {
        key: "avis.processus",
        label: "Processus de collecte CONTINU convenu avec le client",
        hint: "Qui demande, quand, comment — et demander du TEXTE (« écrivez deux phrases »), pas juste des étoiles.",
        manual: true,
      },
      {
        key: "avis.reponses",
        label: "100 % des avis existants ont une réponse",
        hint: "L'app fait le reste au quotidien — l'historique se rattrape à l'onboarding.",
        manual: true,
      },
      {
        key: "avis.conformite",
        label: "Client averti : JAMAIS d'avis achetés, incités ou filtrés",
        hint: "La politique Fake Engagement gèle les nouveaux avis et peut dépublier les existants.",
        manual: true,
      },
    ],
  },
  {
    key: "lancement",
    title: "Lancement",
    why: "Les posts n'affectent pas directement le classement (test Sterling Sky), mais une fiche vivante convertit mieux — et c'est le produit que le client paie.",
    section: "qna",
    requirements: [
      {
        key: "lancement.qna",
        label: "Au moins 3 questions-réponses rédigées",
        hint: "On pose ses propres questions (soumission ? zone desservie ? garanties ?) et on y répond au nom de l'entreprise. (Push Q&A à venir — copier-coller sur la fiche en attendant.)",
        test: (ctx) =>
          (ctx.profile.qna?.filter(
            (pair) => filled(pair.question) && filled(pair.answer),
          ).length ?? 0) >= 3,
      },
      {
        key: "lancement.profil-marque",
        label: "Profil de marque complété dans l'app (ton, services, arguments)",
        hint: "C'est ce qui nourrit l'IA pour les réponses d'avis et les posts.",
        appTab: "settings",
        test: (ctx) => ctx.brandProfileComplete,
      },
      {
        key: "lancement.cadence-posts",
        label: "Cadence configurée + premier post généré et approuvé",
        hint: "File posts → une idée de lancement → générer, réviser, approuver.",
        manual: true,
        appTab: "posts",
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

export interface OnboardingProgress {
  done: number;
  total: number;
  /** 0-100, arrondi. */
  pct: number;
  complete: boolean;
  /** Étapes dont tous les critères sont remplis. */
  doneSteps: Set<string>;
}

export function onboardingProgress(ctx: OnboardingCtx): OnboardingProgress {
  let done = 0;
  const doneSteps = new Set<string>();
  for (const step of ONBOARDING_STEPS) {
    let stepDone = true;
    for (const requirement of step.requirements) {
      if (isRequirementMet(requirement, ctx)) done++;
      else stepDone = false;
    }
    if (stepDone) doneSteps.add(step.key);
  }
  return {
    done,
    total: ONBOARDING_TOTAL,
    pct: Math.round((done / ONBOARDING_TOTAL) * 100),
    complete: done === ONBOARDING_TOTAL,
    doneSteps,
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
