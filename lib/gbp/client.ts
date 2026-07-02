import "server-only";

import type {
  GbpAccount,
  GbpLocation,
  LocalPostInput,
  LocalPostState,
  ReviewsPage,
} from "./types";
import { MockGbpClient } from "./mock";
import { RealGbpClient } from "./real";

export interface GbpClient {
  listAccounts(): Promise<GbpAccount[]>;
  listLocations(accountId: string): Promise<GbpLocation[]>;
  batchGetReviews(
    accountId: string,
    locationNames: string[],
    pageToken?: string,
  ): Promise<ReviewsPage>;
  putReviewReply(reviewName: string, comment: string): Promise<void>;
  deleteReviewReply(reviewName: string): Promise<void>;
  createLocalPost(
    locationName: string,
    post: LocalPostInput,
  ): Promise<{ name: string; state: LocalPostState }>;
  deleteLocalPost(postName: string): Promise<void>;
}

let client: GbpClient | null = null;

/** Switch mock/real sur GBP_MODE — zéro changement de code (specs/README §1). */
export function getGbpClient(): GbpClient {
  if (!client) {
    client =
      (process.env.GBP_MODE ?? "mock") === "real"
        ? new RealGbpClient()
        : new MockGbpClient();
  }
  return client;
}
