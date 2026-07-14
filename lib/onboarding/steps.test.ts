import { describe, expect, it } from "vitest";
import type { GbpProfileData } from "@/lib/types/database";
import {
  isKnownOnboardingItem,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  onboardingCtx,
  onboardingProgress,
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
