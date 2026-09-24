import { describe, expect, it } from "vitest";
import { aggregate, RECENCY_DAYS, STREAK_MONTHS } from "./review-stats";

const NOW = Date.UTC(2026, 8, 24); // 24 septembre 2026
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const review = (over: Partial<Parameters<typeof aggregate>[0][number]> = {}) => ({
  client_id: "c1",
  comment: "Excellent service.",
  review_created_at: daysAgo(3),
  status: "replied",
  ...over,
});

describe("aggregate", () => {
  it("compte séparément le total et les avis avec texte", () => {
    const stats = aggregate(
      [review(), review({ comment: null }), review({ comment: "   " })],
      NOW,
    );
    expect(stats.total).toBe(3);
    // Les étoiles seules pèsent moins : un blanc n'est pas du texte.
    expect(stats.withText).toBe(1);
  });

  it("mesure les jours depuis le dernier avis", () => {
    const stats = aggregate(
      [review({ review_created_at: daysAgo(30) }), review({ review_created_at: daysAgo(5) })],
      NOW,
    );
    expect(stats.daysSinceLastReview).toBe(5);
  });

  it("sans avis daté, la récence est inconnue — pas zéro", () => {
    // Zéro voudrait dire « avis reçu aujourd'hui » : exactement le
    // contresens qui ferait passer le critère de récence au vert.
    const stats = aggregate([review({ review_created_at: null })], NOW);
    expect(stats.daysSinceLastReview).toBeNull();
  });

  it("seul « replied » compte comme répondu", () => {
    const stats = aggregate(
      [review({ status: "replied" }), review({ status: "draft_ready" }), review({ status: "ignored" })],
      NOW,
    );
    expect(stats.unanswered).toBe(2);
  });

  it("compte les mois distincts avec avis, pas le nombre d'avis", () => {
    const stats = aggregate(
      [
        review({ review_created_at: daysAgo(3) }),
        review({ review_created_at: daysAgo(5) }),
        review({ review_created_at: daysAgo(40) }),
        review({ review_created_at: daysAgo(70) }),
      ],
      NOW,
    );
    expect(stats.monthsWithReview).toBe(3);
  });

  it("ignore les avis hors de la fenêtre de flux", () => {
    const stats = aggregate(
      [review({ review_created_at: daysAgo(3) }), review({ review_created_at: daysAgo(200) })],
      NOW,
    );
    expect(stats.monthsWithReview).toBe(1);
    expect(stats.total).toBe(2);
  });

  it("un projet sans avis rend des zéros, pas un trou", () => {
    const stats = aggregate([], NOW);
    expect(stats).toEqual({
      total: 0,
      withText: 0,
      unanswered: 0,
      daysSinceLastReview: null,
      monthsWithReview: 0,
    });
  });

  it("les seuils affichés dans la checklist sont ceux du code", () => {
    expect(RECENCY_DAYS).toBe(21);
    expect(STREAK_MONTHS).toBe(3);
  });
});
