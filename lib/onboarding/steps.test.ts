import { describe, expect, it } from "vitest";
import type { GbpProfileData } from "@/lib/types/database";
import {
  isKnownOnboardingItem,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  onboardingCtx,
  onboardingProgress,
  ONBOARDING_WEIGHT_TOTAL,
  type ReviewStats,
} from "./steps";

/** Fiche dont les avis remplissent les trois critères mesurés. */
const fullReviews: ReviewStats = {
  total: 14,
  withText: 12,
  daysSinceLastReview: 4,
  unanswered: 0,
  monthsWithReview: 3,
};

const emptyCtx = onboardingCtx({
  gbp_profile: {},
  onboarding: {},
  brandProfileComplete: false,
});

/** Profil qui remplit tous les critères automatiques. */
const fullProfile: GbpProfileData = {
  categories: { primary: "Couvreur", additional: ["Entrepreneur en toiture"] },
  identity: {
    name: "Toitures Bergeron",
    address: "1 rue Test, Sainte-Thérèse, QC",
    phone: "450-555-0123",
    website: "https://toituresbergeron.ca",
  },
  hours: {
    monday: { open: "08:00", close: "17:00" },
    tuesday: { open: "08:00", close: "17:00" },
    wednesday: { open: "08:00", close: "17:00" },
    thursday: { open: "08:00", close: "17:00" },
    friday: { open: "08:00", close: "17:00" },
    saturday: null,
    sunday: null,
  },
  description: "x".repeat(300),
  opening_date: "2008-04",
  services: [
    { name: "Réfection de toiture", description: "On refait au complet." },
    { name: "Réparation d'urgence", description: "Infiltrations, 24 h." },
    { name: "Inspection", description: "Par drone, rapport photo." },
  ],
  qna: [
    { question: "Zone desservie ?", answer: "Rive-Nord." },
    { question: "Soumission gratuite ?", answer: "Oui, sous 48 h." },
    { question: "Garanties ?", answer: "10 ans sur la pose." },
  ],
  photos: [
    { path: "c/logo.jpg", url: "https://x/logo.jpg", role: "logo", at: "2026-07-14" },
    { path: "c/cover.jpg", url: "https://x/cover.jpg", role: "cover", at: "2026-07-14" },
    ...Array.from({ length: 10 }, (_, i) => ({
      path: `c/photo-${i}.jpg`,
      url: `https://x/photo-${i}.jpg`,
      role: "photo" as const,
      at: "2026-07-14",
    })),
  ],
};

/** Toutes les cases manuelles cochées. */
const allManualChecks = Object.fromEntries(
  ONBOARDING_STEPS.flatMap((step) =>
    step.requirements
      .filter((req) => req.manual)
      .map((req) => [req.key, { done: true }]),
  ),
);

describe("onboardingProgress (v2 — données + checks manuels)", () => {
  it("état vide : 0 %", () => {
    const progress = onboardingProgress(emptyCtx);
    expect(progress.done).toBe(0);
    expect(progress.pct).toBe(0);
    expect(progress.complete).toBe(false);
  });

  it("les données remplies satisfont les critères automatiques", () => {
    const progress = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: true,
        reviews: fullReviews,
      }),
    );
    const autoCount = ONBOARDING_STEPS.flatMap((s) => s.requirements).filter(
      (r) => r.test,
    ).length;
    expect(progress.done).toBe(autoCount);
    expect(progress.complete).toBe(false); // les manuels restent
  });

  it("données + checks manuels = 100 %", () => {
    const progress = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: { items: allManualChecks },
        brandProfileComplete: true,
        reviews: fullReviews,
      }),
    );
    expect(progress.done).toBe(ONBOARDING_TOTAL);
    expect(progress.complete).toBe(true);
    expect(progress.doneSteps.size).toBe(ONBOARDING_STEPS.length);
  });

  it("heures : les 7 jours doivent être définis (fermé compte)", () => {
    const partial = {
      ...fullProfile,
      hours: { ...fullProfile.hours, sunday: undefined },
    };
    const progress = onboardingProgress(
      onboardingCtx({
        gbp_profile: partial,
        onboarding: {},
        brandProfileComplete: false,
        reviews: fullReviews,
      }),
    );
    const full = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: false,
        reviews: fullReviews,
      }),
    );
    expect(progress.done).toBe(full.done - 1);
  });

  it("photos : logo + couverture et 10 photos de galerie requis", () => {
    const nineGallery = {
      ...fullProfile,
      photos: (fullProfile.photos ?? []).slice(0, 11), // logo + cover + 9
    };
    const a = onboardingProgress(
      onboardingCtx({
        gbp_profile: nineGallery,
        onboarding: {},
        brandProfileComplete: false,
        reviews: fullReviews,
      }),
    );
    const b = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: false,
        reviews: fullReviews,
      }),
    );
    expect(a.done).toBe(b.done - 1);
  });

  it("description : 250 caractères minimum", () => {
    const short = { ...fullProfile, description: "Trop court." };
    const a = onboardingProgress(
      onboardingCtx({
        gbp_profile: short,
        onboarding: {},
        brandProfileComplete: false,
        reviews: fullReviews,
      }),
    );
    const b = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: false,
        reviews: fullReviews,
      }),
    );
    expect(a.done).toBe(b.done - 1);
  });

  it("les clés de critères sont uniques et préfixées par leur étape", () => {
    const keys = ONBOARDING_STEPS.flatMap((step) =>
      step.requirements.map((req) => req.key),
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const step of ONBOARDING_STEPS) {
      for (const req of step.requirements) {
        expect(req.key.startsWith(`${step.key}.`)).toBe(true);
        // Un critère est soit manuel, soit automatique — jamais ambigu.
        expect(Boolean(req.manual) !== Boolean(req.test)).toBe(true);
      }
    }
  });

  it("isKnownOnboardingItem n'accepte que les critères MANUELS", () => {
    expect(isKnownOnboardingItem("avis.lien")).toBe(true);
    expect(isKnownOnboardingItem("categories.principale")).toBe(false);
    expect(isKnownOnboardingItem("inventé")).toBe(false);
  });
});

describe("score pondéré", () => {
  // Régression de conception : avec un score plat, « date d'ouverture »
  // pesait autant que « catégorie principale », premier facteur de
  // classement. Une fiche à 70 % pouvait rater tout ce qui compte.
  it("la catégorie principale pèse plus que la date d'ouverture", () => {
    const requirements = ONBOARDING_STEPS.flatMap((step) => step.requirements);
    const categorie = requirements.find((r) => r.key === "categories.principale");
    const ouverture = requirements.find((r) => r.key === "presentation.ouverture");
    expect(categorie!.weight).toBeGreaterThan(ouverture!.weight);
  });

  it("deux critères remplis ne donnent pas le même score selon leur poids", () => {
    const lourd = onboardingProgress(
      onboardingCtx({
        gbp_profile: { categories: { primary: "Couvreur" } },
        onboarding: {},
        brandProfileComplete: false,
      }),
    );
    const leger = onboardingProgress(
      onboardingCtx({
        gbp_profile: { opening_date: "2008-04" },
        onboarding: {},
        brandProfileComplete: false,
      }),
    );
    expect(lourd.done).toBe(leger.done);
    expect(lourd.pct).toBeGreaterThan(leger.pct);
  });

  it("chaque critère porte un poids et un niveau de preuve", () => {
    for (const requirement of ONBOARDING_STEPS.flatMap((s) => s.requirements)) {
      expect(requirement.weight).toBeGreaterThanOrEqual(1);
      expect(requirement.weight).toBeLessThanOrEqual(5);
      expect(["prouvé", "corrélé", "pratique"]).toContain(requirement.evidence);
    }
  });

  it("le total des poids correspond à la somme des critères", () => {
    const sum = ONBOARDING_STEPS.flatMap((s) => s.requirements).reduce(
      (acc, r) => acc + r.weight,
      0,
    );
    expect(ONBOARDING_WEIGHT_TOTAL).toBe(sum);
  });

  it("nextBest propose d'abord les critères les plus lourds", () => {
    const progress = onboardingProgress(emptyCtx);
    expect(progress.nextBest).toHaveLength(3);
    expect(progress.nextBest[0].weight).toBe(5);
  });
});

describe("critères d'avis mesurés", () => {
  const met = (key: string, reviews?: ReviewStats) => {
    const requirement = ONBOARDING_STEPS.flatMap((s) => s.requirements).find(
      (r) => r.key === key,
    )!;
    return requirement.test!(
      onboardingCtx({
        gbp_profile: {},
        onboarding: {},
        brandProfileComplete: false,
        reviews,
      }),
    );
  };

  it("sans mesure, les critères d'avis restent à faire", () => {
    expect(met("avis.volume-texte")).toBe(false);
    expect(met("avis.recence")).toBe(false);
    expect(met("avis.flux")).toBe(false);
    expect(met("avis.reponses")).toBe(false);
  });

  it("ce sont les avis AVEC TEXTE qui comptent, pas le total", () => {
    expect(met("avis.volume-texte", { ...fullReviews, total: 40, withText: 9 })).toBe(false);
    expect(met("avis.volume-texte", { ...fullReviews, total: 10, withText: 10 })).toBe(true);
  });

  it("la récence tombe au-delà de 21 jours", () => {
    expect(met("avis.recence", { ...fullReviews, daysSinceLastReview: 21 })).toBe(true);
    expect(met("avis.recence", { ...fullReviews, daysSinceLastReview: 22 })).toBe(false);
    expect(met("avis.recence", { ...fullReviews, daysSinceLastReview: null })).toBe(false);
  });

  it("un projet sans aucun avis n'a pas « 100 % répondus »", () => {
    expect(met("avis.reponses", { ...fullReviews, total: 0, unanswered: 0 })).toBe(false);
  });
});
