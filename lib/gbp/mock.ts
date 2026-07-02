import type { GbpClient } from "./client";
import type {
  GbpAccount,
  GbpLocation,
  GbpReview,
  LocalPostState,
  ReviewsPage,
  StarRatingEnum,
} from "./types";
import accountsFixture from "./fixtures/accounts.json";
import locationsFixture from "./fixtures/locations.json";
import reviewsFixture from "./fixtures/reviews.json";

interface ReviewFixture {
  reviewId: string;
  displayName: string | null;
  starRating: string;
  comment: string | null;
  ageHours: number;
  replied: boolean;
}

interface LocationReviewsFixture {
  locationName: string;
  reviews: ReviewFixture[];
}

const MOCK_REPLY =
  "Merci beaucoup pour votre confiance! Au plaisir de vous revoir.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simule la latence réseau (300–800 ms) et ~5 % d'échecs aléatoires
 * pour exercer la gestion d'erreur. GBP_MOCK_FAILURES=0 désactive
 * les échecs (utile pour les tests et les démos).
 */
async function simulateNetwork(): Promise<void> {
  await sleep(300 + Math.random() * 500);
  const failuresEnabled = process.env.GBP_MOCK_FAILURES !== "0";
  if (failuresEnabled && Math.random() < 0.05) {
    throw new Error(
      "Erreur simulée du mock GBP (désactivable via GBP_MOCK_FAILURES=0).",
    );
  }
}

function toGbpReview(
  locationName: string,
  fixture: ReviewFixture,
): GbpReview {
  const createTime = new Date(
    Date.now() - fixture.ageHours * 3600_000,
  ).toISOString();
  return {
    name: `${locationName}/reviews/${fixture.reviewId}`,
    reviewId: fixture.reviewId,
    reviewer: fixture.displayName
      ? { displayName: fixture.displayName }
      : { isAnonymous: true },
    starRating: fixture.starRating as StarRatingEnum,
    comment: fixture.comment ?? undefined,
    createTime,
    updateTime: createTime,
    reviewReply: fixture.replied
      ? {
          comment: MOCK_REPLY,
          updateTime: new Date(
            Date.now() - (fixture.ageHours - 24) * 3600_000,
          ).toISOString(),
        }
      : undefined,
  };
}

export class MockGbpClient implements GbpClient {
  async listAccounts(): Promise<GbpAccount[]> {
    await simulateNetwork();
    return accountsFixture as GbpAccount[];
  }

  async listLocations(): Promise<GbpLocation[]> {
    await simulateNetwork();
    return locationsFixture as GbpLocation[];
  }

  async batchGetReviews(
    accountId: string,
    locationNames: string[],
  ): Promise<ReviewsPage> {
    await simulateNetwork();
    const wanted = new Set(locationNames);
    const bundles = (reviewsFixture as LocationReviewsFixture[])
      .filter((bundle) => wanted.has(bundle.locationName))
      .map((bundle) => ({
        locationName: bundle.locationName,
        reviews: bundle.reviews.map((r) => toGbpReview(bundle.locationName, r)),
      }));
    return { locationReviews: bundles };
  }

  async putReviewReply(): Promise<void> {
    // Le côté Supabase (statuts, published_text) est géré par l'appelant;
    // le mock ne simule que l'acceptation côté Google.
    await simulateNetwork();
  }

  async deleteReviewReply(): Promise<void> {
    await simulateNetwork();
  }

  async createLocalPost(
    locationName: string,
  ): Promise<{ name: string; state: LocalPostState }> {
    await simulateNetwork();
    const id = `mock-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return { name: `${locationName}/localPosts/${id}`, state: "LIVE" };
  }

  async deleteLocalPost(): Promise<void> {
    await simulateNetwork();
  }
}
