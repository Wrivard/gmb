// Mapping des reviews GBP → lignes `reviews` et décisions de statut
// à l'import (specs/04 §cron sync-reviews). Fonctions pures, testées.

import { STAR_RATING_MAP, type GbpReview } from "./types";
import type { Review, ReviewStatus } from "@/lib/types/database";

export function starRatingToInt(rating: GbpReview["starRating"]): number {
  return STAR_RATING_MAP[rating];
}

/** `reviewer.isAnonymous` possible → « Utilisateur Google » (specs/04). */
export function reviewerDisplayName(
  reviewer: GbpReview["reviewer"],
): string | null {
  if (reviewer.isAnonymous || !reviewer.displayName) {
    return "Utilisateur Google";
  }
  return reviewer.displayName;
}

export interface MappedReview {
  gbp_review_id: string;
  gbp_review_name: string;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  star_rating: number;
  comment: string | null;
  review_created_at: string;
  review_updated_at: string | null;
  has_reply: boolean;
}

export function mapGbpReview(review: GbpReview): MappedReview {
  return {
    gbp_review_id: review.reviewId,
    gbp_review_name: review.name,
    reviewer_name: reviewerDisplayName(review.reviewer),
    reviewer_photo_url: review.reviewer.profilePhotoUrl ?? null,
    star_rating: starRatingToInt(review.starRating),
    comment: review.comment ?? null,
    review_created_at: review.createTime,
    review_updated_at:
      review.updateTime !== review.createTime ? review.updateTime : null,
    has_reply: Boolean(review.reviewReply),
  };
}

export type SyncDecision =
  | { kind: "skip" }
  | { kind: "insert"; status: ReviewStatus }
  | {
      kind: "update";
      status: ReviewStatus;
      wasUpdated: boolean;
    };

/**
 * Décide quoi faire d'une review importée (specs/04 §3) :
 * - inconnue sans réponse → insert `needs_reply` (le draft AI suit);
 * - inconnue avec réponse (répondue manuellement ailleurs) → insert `replied`;
 * - connue et modifiée → update; si elle était répondue et que le texte a
 *   changé, repasser en `needs_reply` avec le flag `was_updated`;
 * - connue et inchangée → skip.
 */
export function decideSync(
  incoming: MappedReview,
  existing: Pick<
    Review,
    "comment" | "star_rating" | "review_updated_at" | "status"
  > | null,
): SyncDecision {
  if (!existing) {
    return {
      kind: "insert",
      status: incoming.has_reply ? "replied" : "needs_reply",
    };
  }

  const unchanged =
    existing.comment === incoming.comment &&
    existing.star_rating === incoming.star_rating &&
    (existing.review_updated_at ?? null) ===
      (incoming.review_updated_at ?? null);

  if (unchanged) {
    // Répondue manuellement ailleurs (Google) alors que l'app la croyait en attente.
    if (
      incoming.has_reply &&
      existing.status !== "replied" &&
      existing.status !== "ignored"
    ) {
      return { kind: "update", status: "replied", wasUpdated: false };
    }
    return { kind: "skip" };
  }

  const textChanged = existing.comment !== incoming.comment;
  if (existing.status === "replied" && textChanged) {
    return { kind: "update", status: "needs_reply", wasUpdated: true };
  }
  return { kind: "update", status: existing.status, wasUpdated: false };
}
