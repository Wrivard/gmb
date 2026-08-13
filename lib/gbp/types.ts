// Types de la couche GBP — modelés sur les payloads réels des APIs
// Google Business Profile (v1 + v4 legacy). Voir specs/04-GOOGLE-API.md.

export interface GbpAccount {
  /** Resource name : `accounts/{accountId}` */
  name: string;
  accountName: string;
  type: "PERSONAL" | "LOCATION_GROUP" | "USER_GROUP" | "ORGANIZATION";
}

export interface GbpLocation {
  /** Resource name : `locations/{locationId}` */
  name: string;
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  categories?: {
    primaryCategory?: { displayName?: string };
  };
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
}

/** Enum Google → int (specs/04) */
export const STAR_RATING_MAP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
} as const;

export type StarRatingEnum = keyof typeof STAR_RATING_MAP;

export interface GbpReview {
  /** Resource name complet : `accounts/{a}/locations/{l}/reviews/{r}` */
  name: string;
  reviewId: string;
  reviewer: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating: StarRatingEnum;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface LocationReviewsBundle {
  /** `accounts/{a}/locations/{l}` */
  locationName: string;
  reviews: GbpReview[];
}

export interface ReviewsPage {
  locationReviews: LocationReviewsBundle[];
  nextPageToken?: string;
}

export interface LocalPostInput {
  languageCode: string;
  topicType: "STANDARD";
  summary: string;
  callToAction?: {
    actionType: "LEARN_MORE" | "CALL" | "BOOK" | "ORDER" | "SIGN_UP";
    url?: string;
  };
  media?: Array<{
    mediaFormat: "PHOTO";
    sourceUrl: string;
  }>;
}

export type LocalPostState = "LIVE" | "PROCESSING" | "REJECTED";

/**
 * Erreur typée : 429 quota 0 = projet GCP pas encore approuvé par Google.
 * L'UI la transforme en banner « Accès API Google en attente d'approbation ».
 */
export class GbpAccessPendingError extends Error {
  constructor() {
    super(
      "Accès aux APIs Google Business Profile en attente d'approbation (quota 0).",
    );
    this.name = "GbpAccessPendingError";
  }
}

/**
 * Google explique toujours ses refus dans le corps de la réponse
 * (« ... API has not been used in project X before or it is disabled »).
 * Sans ça, un échec ne remontait que « accounts.list → 403 » : le code
 * sans la cause, donc rien d'actionnable.
 */
export function googleErrorDetail(body?: string): string {
  if (!body?.trim()) return "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string };
    };
    const message = parsed.error?.message?.trim();
    if (message) {
      const status = parsed.error?.status;
      return ` — ${status ? `${status} : ` : ""}${message}`;
    }
  } catch {
    // Corps non JSON : on garde un extrait brut.
  }
  return ` — ${body.trim().slice(0, 300)}`;
}

export class GbpApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
  ) {
    super(`${message}${googleErrorDetail(body)}`);
    this.name = "GbpApiError";
  }
}
