import { describe, expect, it } from "vitest";
import {
  decideSync,
  mapGbpReview,
  reviewerDisplayName,
  starRatingToInt,
} from "./mapping";
import type { GbpReview } from "./types";

function gbpReview(overrides: Partial<GbpReview> = {}): GbpReview {
  return {
    name: "accounts/1/locations/2/reviews/r1",
    reviewId: "r1",
    reviewer: { displayName: "Julie Tremblay" },
    starRating: "FIVE",
    comment: "Super service!",
    createTime: "2026-07-01T12:00:00Z",
    updateTime: "2026-07-01T12:00:00Z",
    ...overrides,
  };
}

describe("mapGbpReview", () => {
  it("mappe l'enum starRating vers un int", () => {
    expect(starRatingToInt("ONE")).toBe(1);
    expect(starRatingToInt("FIVE")).toBe(5);
    expect(mapGbpReview(gbpReview({ starRating: "THREE" })).star_rating).toBe(
      3,
    );
  });

  it("reviewer anonyme → « Utilisateur Google »", () => {
    expect(reviewerDisplayName({ isAnonymous: true })).toBe(
      "Utilisateur Google",
    );
    expect(reviewerDisplayName({})).toBe("Utilisateur Google");
    expect(reviewerDisplayName({ displayName: "Marc" })).toBe("Marc");
  });

  it("review sans commentaire → comment null", () => {
    expect(mapGbpReview(gbpReview({ comment: undefined })).comment).toBeNull();
  });

  it("updateTime égal à createTime → review_updated_at null", () => {
    expect(mapGbpReview(gbpReview()).review_updated_at).toBeNull();
    expect(
      mapGbpReview(gbpReview({ updateTime: "2026-07-02T08:00:00Z" }))
        .review_updated_at,
    ).toBe("2026-07-02T08:00:00Z");
  });

  it("détecte une réponse existante", () => {
    expect(mapGbpReview(gbpReview()).has_reply).toBe(false);
    expect(
      mapGbpReview(
        gbpReview({
          reviewReply: { comment: "Merci!", updateTime: "2026-07-01T13:00:00Z" },
        }),
      ).has_reply,
    ).toBe(true);
  });
});

describe("decideSync", () => {
  const incoming = mapGbpReview(gbpReview());

  it("review inconnue sans réponse → insert needs_reply", () => {
    expect(decideSync(incoming, null)).toEqual({
      kind: "insert",
      status: "needs_reply",
    });
  });

  it("review inconnue déjà répondue ailleurs → insert replied", () => {
    const withReply = mapGbpReview(
      gbpReview({
        reviewReply: { comment: "Merci!", updateTime: "2026-07-01T13:00:00Z" },
      }),
    );
    expect(decideSync(withReply, null)).toEqual({
      kind: "insert",
      status: "replied",
    });
  });

  it("review connue et inchangée → skip", () => {
    expect(
      decideSync(incoming, {
        comment: "Super service!",
        star_rating: 5,
        review_updated_at: null,
        status: "draft_ready",
      }),
    ).toEqual({ kind: "skip" });
  });

  it("review répondue dont le texte a changé → needs_reply + was_updated", () => {
    const edited = mapGbpReview(
      gbpReview({
        comment: "Finalement déçu du suivi.",
        starRating: "TWO",
        updateTime: "2026-07-02T09:00:00Z",
      }),
    );
    expect(
      decideSync(edited, {
        comment: "Super service!",
        star_rating: 5,
        review_updated_at: null,
        status: "replied",
      }),
    ).toEqual({ kind: "update", status: "needs_reply", wasUpdated: true });
  });

  it("review en attente modifiée → update sans changer le statut", () => {
    const edited = mapGbpReview(
      gbpReview({ starRating: "FOUR", updateTime: "2026-07-02T09:00:00Z" }),
    );
    expect(
      decideSync(edited, {
        comment: "Super service!",
        star_rating: 5,
        review_updated_at: null,
        status: "draft_ready",
      }),
    ).toEqual({ kind: "update", status: "draft_ready", wasUpdated: false });
  });

  it("répondue manuellement sur Google alors qu'en attente ici → replied", () => {
    const withReply = mapGbpReview(
      gbpReview({
        reviewReply: { comment: "Merci!", updateTime: "2026-07-01T13:00:00Z" },
      }),
    );
    expect(
      decideSync(withReply, {
        comment: "Super service!",
        star_rating: 5,
        review_updated_at: null,
        status: "needs_reply",
      }),
    ).toEqual({ kind: "update", status: "replied", wasUpdated: false });
  });
});
