import type { GbpClient } from "./client";
import {
  GbpAccessPendingError,
  GbpApiError,
  type GbpAccount,
  type GbpLocation,
  type LocalPostInput,
  type LocalPostState,
  type ReviewsPage,
} from "./types";
import { getAccessToken } from "@/lib/google/token";

const ACCOUNT_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GMB_V4 = "https://mybusiness.googleapis.com/v4";

const LOCATION_READ_MASK =
  "name,title,storefrontAddress,categories,phoneNumbers,websiteUri";

const MAX_ATTEMPTS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backoff exponentiel + jitter sur 429/5xx : 1s, 2s, 4s, 8s (max 5 essais).
 * Un 429 qui persiste à travers tous les essais = très probablement quota 0
 * (projet GCP pas encore approuvé) → GbpAccessPendingError (specs/00 §4).
 */
async function gbpFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const base = 1000 * 2 ** (attempt - 1);
      await sleep(base + Math.random() * 500);
    }

    const accessToken = await getAccessToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (response.status !== 429 && response.status < 500) {
      return response;
    }
    lastResponse = response;
  }

  if (lastResponse?.status === 429) {
    throw new GbpAccessPendingError();
  }
  throw new GbpApiError(
    `Échec GBP après ${MAX_ATTEMPTS} essais (${lastResponse?.status}).`,
    lastResponse?.status ?? 0,
    await lastResponse?.text(),
  );
}

async function parseOrThrow<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    throw new GbpApiError(
      `${context} → ${response.status}`,
      response.status,
      await response.text(),
    );
  }
  return (await response.json()) as T;
}

export class RealGbpClient implements GbpClient {
  async listAccounts(): Promise<GbpAccount[]> {
    const accounts: GbpAccount[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${ACCOUNT_MGMT}/accounts`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const json = await parseOrThrow<{
        accounts?: GbpAccount[];
        nextPageToken?: string;
      }>(await gbpFetch(url.toString()), "accounts.list");
      accounts.push(...(json.accounts ?? []));
      pageToken = json.nextPageToken;
    } while (pageToken);
    return accounts;
  }

  async listLocations(accountId: string): Promise<GbpLocation[]> {
    const locations: GbpLocation[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${BUSINESS_INFO}/${accountId}/locations`);
      url.searchParams.set("readMask", LOCATION_READ_MASK);
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const json = await parseOrThrow<{
        locations?: GbpLocation[];
        nextPageToken?: string;
      }>(await gbpFetch(url.toString()), "locations.list");
      locations.push(...(json.locations ?? []));
      pageToken = json.nextPageToken;
    } while (pageToken);
    return locations;
  }

  async batchGetReviews(
    accountId: string,
    locationNames: string[],
    pageToken?: string,
  ): Promise<ReviewsPage> {
    const response = await gbpFetch(
      `${GMB_V4}/${accountId}/locations:batchGetReviews`,
      {
        method: "POST",
        body: JSON.stringify({
          locationNames,
          pageSize: 50,
          orderBy: "updateTime desc",
          ignoreRatingOnlyReviews: false,
          ...(pageToken ? { pageToken } : {}),
        }),
      },
    );
    // Réponse v4 aplatie : une entrée { name, review } par review.
    const json = await parseOrThrow<{
      locationReviews?: Array<{
        name: string;
        review?: ReviewsPage["locationReviews"][number]["reviews"][number];
      }>;
      nextPageToken?: string;
    }>(response, "batchGetReviews");

    const byLocation = new Map<
      string,
      ReviewsPage["locationReviews"][number]["reviews"]
    >();
    for (const entry of json.locationReviews ?? []) {
      if (!entry.review) continue;
      const list = byLocation.get(entry.name) ?? [];
      list.push(entry.review);
      byLocation.set(entry.name, list);
    }

    return {
      locationReviews: [...byLocation.entries()].map(
        ([locationName, reviews]) => ({ locationName, reviews }),
      ),
      nextPageToken: json.nextPageToken,
    };
  }

  async putReviewReply(reviewName: string, comment: string): Promise<void> {
    const response = await gbpFetch(`${GMB_V4}/${reviewName}/reply`, {
      method: "PUT",
      body: JSON.stringify({ comment }),
    });
    await parseOrThrow(response, "putReviewReply");
  }

  async deleteReviewReply(reviewName: string): Promise<void> {
    const response = await gbpFetch(`${GMB_V4}/${reviewName}/reply`, {
      method: "DELETE",
    });
    await parseOrThrow(response, "deleteReviewReply");
  }

  async createLocalPost(
    locationName: string,
    post: LocalPostInput,
  ): Promise<{ name: string; state: LocalPostState }> {
    const response = await gbpFetch(`${GMB_V4}/${locationName}/localPosts`, {
      method: "POST",
      body: JSON.stringify(post),
    });
    const json = await parseOrThrow<{ name: string; state: LocalPostState }>(
      response,
      "createLocalPost",
    );
    return { name: json.name, state: json.state };
  }

  async updateLocation(
    locationName: string,
    patch: Record<string, unknown>,
    updateMask: string,
  ): Promise<void> {
    const url = new URL(`${BUSINESS_INFO}/${locationName}`);
    url.searchParams.set("updateMask", updateMask);
    const response = await gbpFetch(url.toString(), {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    await parseOrThrow(response, "updateLocation");
  }

  async deleteLocalPost(postName: string): Promise<void> {
    const response = await gbpFetch(`${GMB_V4}/${postName}`, {
      method: "DELETE",
    });
    await parseOrThrow(response, "deleteLocalPost");
  }
}
