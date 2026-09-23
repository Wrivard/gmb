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
import { ZernioGbpClient } from "./zernio";
import { gbpMode } from "./mode";

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
  /**
   * Patch partiel de la fiche (Business Information locations.patch).
   * `updateMask` = champs touchés, ex. "profile.description,openInfo".
   */
  updateLocation(
    locationName: string,
    patch: Record<string, unknown>,
    updateMask: string,
  ): Promise<void>;
}

let client: GbpClient | null = null;

/** Switch sur GBP_MODE — zéro changement de code (specs/README §1). */
export function getGbpClient(): GbpClient {
  if (!client) {
    switch (gbpMode()) {
      case "real":
        client = new RealGbpClient();
        break;
      // Google n'a jamais approuvé l'accès API de Küa ; Zernio possède
      // l'approbation et relaie les mêmes appels (cf. lib/gbp/zernio.ts).
      case "zernio":
        client = new ZernioGbpClient();
        break;
      default:
        client = new MockGbpClient();
    }
  }
  return client;
}
