import { describe, expect, it } from "vitest";
import {
  isKnownOnboardingItem,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL,
  onboardingProgress,
} from "./steps";

describe("onboardingProgress", () => {
  it("état vide : 0 %, rien de complété", () => {
    const progress = onboardingProgress({});
    expect(progress.done).toBe(0);
    expect(progress.pct).toBe(0);
    expect(progress.complete).toBe(false);
    expect(progress.doneSteps.size).toBe(0);
  });

  it("état null/undefined toléré (colonne default '{}')", () => {
    expect(onboardingProgress(null).done).toBe(0);
    expect(onboardingProgress(undefined).done).toBe(0);
  });

  it("une étape entière cochée apparaît dans doneSteps", () => {
    const step = ONBOARDING_STEPS[0];
    const items = Object.fromEntries(
      step.items.map((item) => [item.key, { done: true }]),
    );
    const progress = onboardingProgress({ items });
    expect(progress.doneSteps.has(step.key)).toBe(true);
    expect(progress.done).toBe(step.items.length);
  });

  it("tout coché = 100 % complet", () => {
    const items = Object.fromEntries(
      ONBOARDING_STEPS.flatMap((step) =>
        step.items.map((item) => [item.key, { done: true }]),
      ),
    );
    const progress = onboardingProgress({ items });
    expect(progress.done).toBe(ONBOARDING_TOTAL);
    expect(progress.pct).toBe(100);
    expect(progress.complete).toBe(true);
    expect(progress.doneSteps.size).toBe(ONBOARDING_STEPS.length);
  });

  it("les clés inconnues ne comptent pas", () => {
    const progress = onboardingProgress({
      items: { "inventé.nimporte": { done: true } },
    });
    expect(progress.done).toBe(0);
  });

  it("les clés d'items sont uniques et préfixées par leur étape", () => {
    const keys = ONBOARDING_STEPS.flatMap((step) =>
      step.items.map((item) => item.key),
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const step of ONBOARDING_STEPS) {
      for (const item of step.items) {
        expect(item.key.startsWith(`${step.key}.`)).toBe(true);
      }
    }
  });

  it("isKnownOnboardingItem valide les clés", () => {
    expect(isKnownOnboardingItem("categories.principale")).toBe(true);
    expect(isKnownOnboardingItem("categories.inexistant")).toBe(false);
  });
});
