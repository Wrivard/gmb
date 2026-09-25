import { describe, expect, it } from "vitest";
import type { GbpProfileData } from "@/lib/types/database";
import {
  isKnownOnboardingItem,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  onboardingCtx,
  onboardingProgress,
  ONBOARDING_WEIGHT_TOTAL,
  galleryCount,
} from "./steps";

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
  special_hours: [{ date: "2026-12-25", closed: true }],
  description: "x".repeat(300),
  opening_date: "2008-04",
  services: [
    {
      name: "Réfection de toiture",
      description: "On refait au complet.",
      // Un service PRÉDÉFINI : c'est lui qui remplit services.predefinis.
      service_type_id: "job_type_id:roof_replacement",
    },
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
      }),
    );
    const full = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: false,
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
      }),
    );
    const b = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: false,
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
      }),
    );
    const b = onboardingProgress(
      onboardingCtx({
        gbp_profile: fullProfile,
        onboarding: {},
        brandProfileComplete: false,
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
        // Un critère est automatique, manuel, ou hybride. Un hybride
        // porte les deux : la donnée le remplit quand elle existe, la
        // case couvre les cas qu'on ne peut pas mesurer (une entreprise
        // sans local public, par exemple).
        expect(Boolean(req.manual) || Boolean(req.test)).toBe(true);
        // Mais un hybride DOIT consulter sa propre case, sinon celle-ci
        // serait cliquable sans effet : `isRequirementMet` privilégie le
        // test dès qu'il existe.
        if (req.manual && req.test) {
          expect(
            req.test(
              onboardingCtx({
                gbp_profile: {},
                onboarding: { items: { [req.key]: { done: true } } },
                brandProfileComplete: false,
              }),
            ),
          ).toBe(true);
        }
      }
    }
  });

  it("isKnownOnboardingItem n'accepte que les critères MANUELS", () => {
    expect(isKnownOnboardingItem("identity.nap-coherent")).toBe(true);
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

describe("photos : ce qui est déjà sur Google compte", () => {
  const req = (key: string) =>
    ONBOARDING_STEPS.flatMap((s) => s.requirements).find((r) => r.key === key)!;

  const ctxWith = (profile: GbpProfileData) =>
    onboardingCtx({
      gbp_profile: profile,
      onboarding: {},
      brandProfileComplete: false,
    });

  const googlePhotos = (count: number, category = "ADDITIONAL") =>
    Array.from({ length: count }, (_, i) => ({
      name: `media/${category}-${i}`,
      category,
      url: `https://lh3.googleusercontent.com/${category}-${i}`,
    }));

  // Une fiche avec logo, couverture et galerie affichait « 0/10 photos »
  // et réclamait des images déjà en ligne.
  it("le logo et la couverture publiés remplissent le critère", () => {
    const ctx = ctxWith({
      google_media: {
        items: [...googlePhotos(1, "PROFILE"), ...googlePhotos(1, "COVER")],
        synced_at: "2026-09-24T00:00:00Z",
      },
    });
    expect(req("photos.logo-couverture").test!(ctx)).toBe(true);
  });

  it("la galerie additionne les photos de Google et celles de l'app", () => {
    const ctx = ctxWith({
      photos: Array.from({ length: 4 }, (_, i) => ({
        path: `p${i}`,
        url: `https://x/${i}`,
        role: "photo" as const,
        at: "2026-09-24",
      })),
      google_media: {
        items: googlePhotos(6),
        synced_at: "2026-09-24T00:00:00Z",
      },
    });
    expect(galleryCount(ctx)).toBe(10);
    expect(req("photos.lot-initial").test!(ctx)).toBe(true);
  });

  it("logo et couverture ne gonflent pas le compte de la galerie", () => {
    const ctx = ctxWith({
      google_media: {
        items: [
          ...googlePhotos(1, "PROFILE"),
          ...googlePhotos(1, "COVER"),
          ...googlePhotos(2),
        ],
        synced_at: "2026-09-24T00:00:00Z",
      },
    });
    expect(galleryCount(ctx)).toBe(2);
  });
});

describe("services prédéfinis", () => {
  const req = ONBOARDING_STEPS.flatMap((s) => s.requirements).find(
    (r) => r.key === "services.predefinis",
  )!;
  const ctxWith = (services: GbpProfileData["services"]) =>
    onboardingCtx({
      gbp_profile: { services },
      onboarding: {},
      brandProfileComplete: false,
    });

  // Le test de Sterling Sky portait sur les services PRÉDÉFINIS : du
  // texte libre, même abondant, ne remplit pas ce critère.
  it("du texte libre seul ne suffit pas", () => {
    expect(
      req.test!(
        ctxWith([
          { name: "Réfection de toiture" },
          { name: "Inspection par drone" },
        ]),
      ),
    ).toBe(false);
  });

  it("un seul service structuré suffit", () => {
    expect(
      req.test!(
        ctxWith([
          { name: "Réfection de toiture" },
          { name: "Rénovation de salle de bain", service_type_id: "job_type_id:bathroom_remodeling" },
        ]),
      ),
    ).toBe(true);
  });

  it("sans service, le critère reste à faire", () => {
    expect(req.test!(ctxWith(undefined))).toBe(false);
    expect(req.test!(ctxWith([]))).toBe(false);
  });

  it("ce critère ne se coche plus à la main", () => {
    expect(req.manual).toBeUndefined();
    expect(isKnownOnboardingItem("services.predefinis")).toBe(false);
  });
});

describe("adresse affichée et heures spéciales", () => {
  const req = (key: string) =>
    ONBOARDING_STEPS.flatMap((s) => s.requirements).find((r) => r.key === key)!;
  const ctxWith = (profile: GbpProfileData, checks = {}) =>
    onboardingCtx({
      gbp_profile: profile,
      onboarding: { items: checks },
      brandProfileComplete: false,
    });

  // Une fiche sans adresse est peut-être une entreprise à domicile qui a
  // raison de la masquer : on mesure ce qu'on sait, la case couvre le reste.
  it("une adresse renseignée remplit le critère sans rien cocher", () => {
    expect(
      req("identity.adresse-visible").test!(
        ctxWith({ identity: { address: "1 rue Test, Sainte-Thérèse" } }),
      ),
    ).toBe(true);
  });

  it("sans adresse, la case à cocher prend le relais", () => {
    expect(req("identity.adresse-visible").test!(ctxWith({}))).toBe(false);
    expect(
      req("identity.adresse-visible").test!(
        ctxWith({}, { "identity.adresse-visible": { done: true } }),
      ),
    ).toBe(true);
  });

  it("la case reste proposée pour les entreprises sans local", () => {
    expect(req("identity.adresse-visible").manual).toBe(true);
    expect(isKnownOnboardingItem("identity.adresse-visible")).toBe(true);
  });

  it("les heures spéciales se mesurent, elles ne se cochent plus", () => {
    const requirement = req("identity.heures-speciales");
    expect(requirement.manual).toBeUndefined();
    expect(requirement.test!(ctxWith({}))).toBe(false);
    expect(
      requirement.test!(
        ctxWith({ special_hours: [{ date: "2026-12-25", closed: true }] }),
      ),
    ).toBe(true);
  });
});
