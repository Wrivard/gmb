// Checklist d'optimisation d'une fiche GBP à l'onboarding d'un projet.
// Ordre et poids fondés sur les études de classement local (recherche
// 2026-07-13) : Whitespark Local Search Ranking Factors 2026, études
// Sterling Sky (services, reviews, posts), BrightLocal, guidelines
// Google. Chaque étape dit POURQUOI (l'impact) — c'est ce qui motive
// l'employé à ne rien sauter.
//
// Pas de "server-only" : consommé aussi par le wizard (client).

import type { OnboardingState } from "@/lib/types/database";

export interface OnboardingItemDef {
  key: string;
  label: string;
  hint?: string;
}

export interface OnboardingStepDef {
  key: string;
  title: string;
  /** L'impact, avec la source — le pitch qui justifie l'étape. */
  why: string;
  items: OnboardingItemDef[];
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    key: "categories",
    title: "Catégories",
    why: "La catégorie principale est LE premier facteur de classement local (32 % du poids, Whitespark 2026). Deux minutes ici valent plus que tout le reste.",
    items: [
      {
        key: "categories.principale",
        label: "Catégorie principale la plus SPÉCIFIQUE possible",
        hint: "« Couvreur » bat « Entrepreneur en construction ». Compare avec les 3 concurrents qui rankent dans le local pack.",
      },
      {
        key: "categories.secondaires",
        label: "Toutes les catégories secondaires pertinentes ajoutées",
        hint: "Chaque service majeur qui a sa catégorie Google — sans exagérer (les non pertinentes diluent).",
      },
    ],
  },
  {
    key: "identite",
    title: "Identité & coordonnées (NAP)",
    why: "Un NAP cohérent partout = +40 % de chances d'apparaître dans le local pack (BrightLocal). Et un nom farci de mots-clés = risque de suspension de la fiche.",
    items: [
      {
        key: "identite.nom",
        label: "Nom EXACT de l'entreprise — aucun mot-clé ajouté",
        hint: "« Toitures Bergeron », pas « Toitures Bergeron | Couvreur Rive-Nord ». Ça ranke mieux mais c'est interdit : suspension possible, on ne joue pas ça avec la fiche d'un client.",
      },
      {
        key: "identite.adresse",
        label: "Adresse exacte affichée (ou zone de service bien définie)",
        hint: "Si l'entreprise peut afficher son adresse, l'afficher : cacher l'adresse corrèle négativement avec le classement « near me » (Sterling Sky 2025).",
      },
      {
        key: "identite.telephone",
        label: "Téléphone local (pas de 1-800)",
        hint: "Le même numéro que sur le site web, format identique.",
      },
      {
        key: "identite.siteweb",
        label: "Site web vers la bonne page",
        hint: "Fiche d'une succursale → sa page locale, pas l'accueil générique.",
      },
      {
        key: "identite.nap-coherent",
        label: "Nom-adresse-téléphone IDENTIQUES sur le site et les annuaires",
        hint: "Vérifie le site du client, Pages Jaunes, Facebook. Les incohérences se corrigent maintenant, pas « un jour ».",
      },
      {
        key: "identite.heures",
        label: "Heures d'ouverture complètes + heures spéciales des fériés",
        hint: "Fériés du Québec pré-remplis pour l'année. Une fiche « fermé ? » un samedi de pointe tue la conversion.",
      },
    ],
  },
  {
    key: "services",
    title: "Services & produits",
    why: "Ajouter les services prédéfinis améliore le classement sur les mots-clés de service (retest Sterling Sky 2022) — surtout quand le service est explicitement cherché.",
    items: [
      {
        key: "services.predefinis",
        label: "TOUS les services prédéfinis pertinents cochés",
        hint: "Google en propose par catégorie — cocher tout ce qui s'applique vraiment.",
      },
      {
        key: "services.custom",
        label: "Services personnalisés ajoutés pour ce qui manque",
        hint: "Les services que les clients cherchent avec leurs mots (« déneigement de toiture », « inspection par drone »).",
      },
      {
        key: "services.descriptions",
        label: "Description remplie pour chaque service principal",
        hint: "2-3 phrases concrètes par service — utile pour l'utilisateur, et du contexte pour Google.",
      },
      {
        key: "services.produits",
        label: "Produits ajoutés si applicable (sinon, cocher et passer)",
        hint: "Commerce de détail/resto : les produits avec photos occupent beaucoup d'espace sur la fiche mobile.",
      },
    ],
  },
  {
    key: "presentation",
    title: "Description & attributs",
    why: "Peu d'impact direct sur le classement (les mots-clés de la description ne rankent pas — BrightLocal), mais c'est ce que lit un humain qui hésite : ça se joue à la conversion.",
    items: [
      {
        key: "presentation.description",
        label: "Description complète (max 750 caractères), l'essentiel dans les 250 premiers",
        hint: "Ce qui rend l'entreprise unique, ses services clés, sa zone. Pas de promo, pas d'URL, pas de bourrage de mots-clés.",
      },
      {
        key: "presentation.attributs",
        label: "Tous les attributs applicables cochés",
        hint: "Accessibilité, paiements acceptés, rendez-vous requis, etc. — selon la catégorie.",
      },
      {
        key: "presentation.ouverture",
        label: "Date d'ouverture renseignée",
        hint: "L'ancienneté rassure — et Google l'affiche (« 15+ ans en affaires »).",
      },
    ],
  },
  {
    key: "photos",
    title: "Photos",
    why: "Les signaux d'engagement (photos vues, clics, appels) pèsent de plus en plus (Whitespark). Des vraies photos de terrain — pas de stock — font la différence à la conversion.",
    items: [
      {
        key: "photos.logo-couverture",
        label: "Logo + photo de couverture posés",
        hint: "La couverture = la première impression dans Maps. Choisis la meilleure photo réelle, pas le logo étiré.",
      },
      {
        key: "photos.lot-initial",
        label: "Minimum 10 vraies photos : extérieur, intérieur, équipe, réalisations",
        hint: "Prises par le client ou l'agence — jamais de banque d'images. Avant/après pour les métiers de la construction.",
      },
      {
        key: "photos.cadence",
        label: "Entente avec le client pour recevoir des photos en continu",
        hint: "1-2 photos fraîches par mois > 50 photos posées une fois. Mets-le dans la routine du client (photos de chantier).",
      },
    ],
  },
  {
    key: "avis",
    title: "Avis",
    why: "20 % du classement local et en croissance (Whitespark 2026). La RÉCENCE bat le volume, les avis AVEC TEXTE battent les étoiles seules, et les 10 premiers avis débloquent un palier (Sterling Sky).",
    items: [
      {
        key: "avis.lien",
        label: "Lien court « laissez-nous un avis » créé et remis au client",
        hint: "Depuis la fiche : Demander des avis → copier le lien. Le client le met dans ses courriels/factures.",
      },
      {
        key: "avis.processus",
        label: "Processus de collecte CONTINU convenu avec le client",
        hint: "Qui demande, quand (fin de mandat, livraison), comment. Un flux régulier bat une campagne unique — la récence compte plus que le total.",
      },
      {
        key: "avis.texte",
        label: "Le client sait demander des avis AVEC TEXTE",
        hint: "« Écrivez deux phrases sur ce qu'on a fait pour vous » — les avis avec texte corrèlent plus fort avec le classement.",
      },
      {
        key: "avis.reponses",
        label: "100 % des avis existants ont une réponse",
        hint: "L'app fait le reste au quotidien — mais l'historique se rattrape à l'onboarding.",
      },
      {
        key: "avis.conformite",
        label: "Client averti : JAMAIS d'avis achetés, incités ou filtrés",
        hint: "La politique Fake Engagement de Google gèle les nouveaux avis et peut dépublier les existants. Tout le capital d'avis du client est en jeu.",
      },
    ],
  },
  {
    key: "lancement",
    title: "Lancement",
    why: "Les posts n'affectent pas directement le classement (test Sterling Sky), mais une fiche vivante convertit mieux — et c'est le produit que le client paie.",
    items: [
      {
        key: "lancement.qna",
        label: "3-5 questions fréquentes posées ET répondues sur la fiche",
        hint: "On peut poser ses propres questions (prix d'une soumission ? zone desservie ? garanties ?) et y répondre au nom de l'entreprise.",
      },
      {
        key: "lancement.profil-marque",
        label: "Profil de marque complété dans l'app (ton, services, arguments)",
        hint: "C'est ce qui nourrit l'IA pour les réponses d'avis et les posts — Réglages du projet.",
      },
      {
        key: "lancement.cadence-posts",
        label: "Cadence de posts configurée + premier post généré et approuvé",
        hint: "File posts → une idée de lancement (« nouvelle gestion de la fiche, bienvenue ») → générer, réviser, approuver.",
      },
    ],
  },
];

/** Nombre total d'items de la checklist. */
export const ONBOARDING_TOTAL = ONBOARDING_STEPS.reduce(
  (sum, step) => sum + step.items.length,
  0,
);

export interface OnboardingProgress {
  done: number;
  total: number;
  /** 0-100, arrondi. */
  pct: number;
  complete: boolean;
  /** Étapes dont tous les items sont cochés. */
  doneSteps: Set<string>;
}

export function onboardingProgress(
  state: OnboardingState | null | undefined,
): OnboardingProgress {
  const items = state?.items ?? {};
  let done = 0;
  const doneSteps = new Set<string>();
  for (const step of ONBOARDING_STEPS) {
    let stepDone = true;
    for (const item of step.items) {
      if (items[item.key]?.done) done++;
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

/** Un item défini ? (garde d'action serveur contre les clés inventées) */
export function isKnownOnboardingItem(key: string): boolean {
  return ONBOARDING_STEPS.some((step) =>
    step.items.some((item) => item.key === key),
  );
}
