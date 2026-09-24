import { describe, expect, it } from "vitest";
import { clientHealth, HEALTH_WEIGHTS, type PostStats } from "./health";
import type { ReviewStats } from "@/lib/onboarding/review-stats";

const goodReviews: ReviewStats = {
  total: 20,
  withText: 18,
  daysSinceLastReview: 5,
  unanswered: 0,
  monthsWithReview: 3,
};

const goodPosts: PostStats = {
  publishedLast30: 2,
  failed: 0,
  monthlyTarget: 2,
};

describe("clientHealth", () => {
  it("tout au vert donne 100 %", () => {
    const health = clientHealth({
      onboardingPct: 100,
      reviews: goodReviews,
      posts: goodPosts,
    });
    expect(health.pct).toBe(100);
    expect(health.status).toBe("ok");
  });

  // Le point de la séparation : une fiche parfaitement optimisée peut
  // être en mauvaise santé parce que le flux d'avis s'est tari. Le
  // wizard reste à 100 %, la santé non.
  it("une fiche parfaite mais sans avis récents n'est plus en santé", () => {
    const health = clientHealth({
      onboardingPct: 100,
      reviews: { ...goodReviews, daysSinceLastReview: 45, monthsWithReview: 1 },
      posts: goodPosts,
    });
    // 80 % pile en moyenne pondérée — mais un pilier à terre interdit
    // le vert : c'est ce que l'équipe doit voir.
    expect(health.status).not.toBe("ok");
    expect(health.worst.key).toBe("avis");
    expect(health.worst.detail).toContain("45 jours");
  });

  it("nomme le pilier par lequel commencer", () => {
    const health = clientHealth({
      onboardingPct: 40,
      reviews: goodReviews,
      posts: goodPosts,
    });
    expect(health.worst.key).toBe("fiche");
    expect(health.worst.detail).toContain("wizard");
  });

  it("une publication en échec pèse, même si la cadence est tenue", () => {
    const sain = clientHealth({
      onboardingPct: 100,
      reviews: goodReviews,
      posts: goodPosts,
    });
    const casse = clientHealth({
      onboardingPct: 100,
      reviews: goodReviews,
      posts: { ...goodPosts, failed: 1 },
    });
    expect(casse.pct).toBeLessThan(sain.pct);
    expect(casse.pillars.find((p) => p.key === "posts")!.detail).toContain(
      "échec",
    );
  });

  it("sans cadence au mandat, les publications ne pénalisent pas", () => {
    const health = clientHealth({
      onboardingPct: 100,
      reviews: goodReviews,
      posts: { publishedLast30: 0, failed: 0, monthlyTarget: 0 },
    });
    expect(health.pillars.find((p) => p.key === "posts")!.pct).toBe(100);
  });

  it("aucune synchronisation d'avis se voit, au lieu de passer pour un zéro", () => {
    const health = clientHealth({
      onboardingPct: 100,
      reviews: undefined,
      posts: goodPosts,
    });
    const avis = health.pillars.find((p) => p.key === "avis")!;
    expect(avis.status).toBe("critical");
    expect(avis.detail).toContain("actif");
  });

  it("la récence et le flux pèsent plus que le volume", () => {
    const volumeSeul = clientHealth({
      onboardingPct: 0,
      reviews: {
        total: 50,
        withText: 50,
        daysSinceLastReview: 120,
        unanswered: 0,
        monthsWithReview: 0,
      },
      posts: goodPosts,
    });
    const fluxSeul = clientHealth({
      onboardingPct: 0,
      reviews: {
        total: 3,
        withText: 3,
        daysSinceLastReview: 2,
        unanswered: 0,
        monthsWithReview: 3,
      },
      posts: goodPosts,
    });
    expect(fluxSeul.pct).toBeGreaterThan(volumeSeul.pct);
  });

  it("les poids reflètent l'absence d'effet classement des posts", () => {
    expect(HEALTH_WEIGHTS.fiche).toBeGreaterThan(HEALTH_WEIGHTS.avis);
    expect(HEALTH_WEIGHTS.avis).toBeGreaterThan(HEALTH_WEIGHTS.posts);
  });
});
