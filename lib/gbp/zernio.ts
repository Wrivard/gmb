import type { GbpClient } from "./client";
import {
  GbpApiError,
  type GbpAccount,
  type GbpAttributeMeta,
  type GbpAttributeValue,
  type GbpLocation,
  type GbpMediaItem,
  type LocalPostInput,
  type LocalPostState,
  type ReviewsPage,
} from "./types";

// Accès GBP via Zernio (ex-Late) plutôt qu'en direct chez Google.
//
// Pourquoi : la demande « Basic API Access » de Küa n'a jamais été
// approuvée (dossiers 9-9683000040961 puis 6-8057000041094, fermé sans
// accès). Les trois APIs Google répondent 429 quota 0 ou 404. Zernio
// possède l'approbation et la revend ; on emprunte la sienne.
//
// Vérifié sur données réelles le 2026-09-23 : 29 fiches clientes
// listées, avis récupérés, format identique à la v4 Google — donc
// `mapGbpReview` et le reste de l'app marchent sans changement.

const BASE = "https://api.zernio.com/v1";

/** `accounts/1/locations/2` ou `locations/2` → `2`. */
function bareLocationId(name: string): string {
  return name.split("/").pop() ?? name;
}

interface ZernioConnectedAccount {
  _id: string;
  platform: string;
}

interface ZernioLocation {
  id: string;
  name: string;
  /** Resource name du compte Google : `accounts/{id}`. */
  accountId: string;
  accountName?: string;
  address?: string;
  category?: string;
  websiteUrl?: string;
}

/** Ce que l'API Business Information renvoie, relayé tel quel. */
interface ZernioLocationDetails {
  title?: string;
  phoneNumbers?: { primaryPhone?: string };
  categories?: GbpLocation["categories"];
  websiteUri?: string;
  storefrontAddress?: GbpLocation["storefrontAddress"];
  profile?: GbpLocation["profile"];
  regularHours?: GbpLocation["regularHours"];
  openInfo?: GbpLocation["openInfo"];
  serviceItems?: GbpLocation["serviceItems"];
}

interface ResolvedAccount {
  /** Id interne Zernio — jamais exposé au reste de l'app. */
  zernioAccountId: string;
  accountName: string;
  locations: ZernioLocation[];
}

const CACHE_TTL_MS = 5 * 60_000;
let cache: { at: number; byGoogleAccount: Map<string, ResolvedAccount> } | null =
  null;

export function clearZernioCache(): void {
  cache = null;
}

function apiKey(): string {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) {
    throw new Error(
      "ZERNIO_API_KEY manquante — la connexion GBP passe par Zernio (GBP_MODE=zernio).",
    );
  }
  return key;
}

const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 429 chez Zernio = limite de débit (60 req/min au palier gratuit), PAS
 * un quota à zéro comme chez Google — d'où le respect de `Retry-After`
 * et l'absence de `GbpAccessPendingError` ici.
 */
async function zernioFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  let last: Response | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const retryAfter = Number(last?.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * 2 ** (attempt - 1);
      await sleep(wait + Math.random() * 300);
    }

    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (response.status !== 429 && response.status < 500) return response;
    last = response;
  }

  throw new GbpApiError(
    `Zernio indisponible après ${MAX_ATTEMPTS} essais (${last?.status}).`,
    last?.status ?? 0,
    await last?.text(),
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

/**
 * Zernio identifie une connexion par son propre id ; l'app raisonne en
 * resource names Google. On construit la correspondance une fois, en
 * listant les fiches de chaque connexion.
 */
async function resolveAccounts(): Promise<Map<string, ResolvedAccount>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.byGoogleAccount;
  }

  const { accounts } = await parseOrThrow<{
    accounts?: ZernioConnectedAccount[];
  }>(await zernioFetch("/accounts"), "zernio.accounts");

  const connected = (accounts ?? []).filter(
    (account) => account.platform === "googlebusiness",
  );
  if (!connected.length) {
    throw new Error(
      "Aucun compte Google Business connecté chez Zernio — refaire la connexion " +
        "jusqu'à l'étape « choisir une fiche » (l'écran Google seul n'enregistre rien).",
    );
  }

  const byGoogleAccount = new Map<string, ResolvedAccount>();
  for (const account of connected) {
    const { locations } = await parseOrThrow<{ locations?: ZernioLocation[] }>(
      await zernioFetch(`/accounts/${account._id}/gmb-locations`),
      "zernio.gmb-locations",
    );
    for (const location of locations ?? []) {
      const existing = byGoogleAccount.get(location.accountId);
      if (existing) {
        existing.locations.push(location);
        continue;
      }
      byGoogleAccount.set(location.accountId, {
        zernioAccountId: account._id,
        accountName: location.accountName ?? location.accountId,
        locations: [location],
      });
    }
  }

  cache = { at: Date.now(), byGoogleAccount };
  return byGoogleAccount;
}

/** `accounts/105.../locations/9...` → la connexion Zernio qui la sert. */
async function accountFor(resourceName: string): Promise<ResolvedAccount> {
  const accounts = await resolveAccounts();

  const googleAccount = /^(accounts\/\d+)/.exec(resourceName)?.[1];
  if (googleAccount) {
    const hit = accounts.get(googleAccount);
    if (hit) return hit;
  }

  // Un `locations/{id}` nu (le wizard stocke ce format) : on retrouve
  // la connexion par la fiche elle-même.
  const bare = bareLocationId(resourceName);
  for (const account of accounts.values()) {
    if (account.locations.some((location) => location.id === bare)) {
      return account;
    }
  }

  throw new Error(
    `Fiche inconnue chez Zernio : ${resourceName} — le compte Google qui la gère n'est pas connecté.`,
  );
}

/** Liste plate → `GbpLocation` : identité et ce qui vient gratuitement. */
function summaryToLocation(location: ZernioLocation): GbpLocation {
  return {
    name: `locations/${location.id}`,
    title: location.name,
    storefrontAddress: location.address
      ? { addressLines: [location.address] }
      : undefined,
    categories: location.category
      ? { primaryCategory: { displayName: location.category } }
      : undefined,
    websiteUri: location.websiteUrl,
  };
}

export interface ZernioConnection {
  /** Resource name du compte Google : `accounts/{id}`. */
  googleAccount: string;
  /** Nom du propriétaire du compte Google, tel que Zernio le rapporte. */
  accountName: string;
  /** Fiches que ce compte expose — pas celles suivies dans l'app. */
  locationCount: number;
}

/**
 * État réel de la connexion GBP en mode `zernio`, pour Réglages.
 *
 * Sans ça, la carte « Connexion Google » lisait `google_connections` —
 * la connexion Google DIRECTE, inutilisée depuis qu'on passe par
 * Zernio. Elle affichait « Connectée » alors que ce n'était pas par là
 * que passaient les données.
 */
export async function listZernioConnections(): Promise<ZernioConnection[]> {
  const accounts = await resolveAccounts();
  return [...accounts.entries()].map(([googleAccount, account]) => ({
    googleAccount,
    accountName: account.accountName,
    locationCount: account.locations.length,
  }));
}

export class ZernioGbpClient implements GbpClient {
  async listAccounts(): Promise<GbpAccount[]> {
    const accounts = await resolveAccounts();
    return [...accounts.entries()].map(([name, account]) => ({
      name,
      accountName: account.accountName,
      // Zernio n'expose pas le type de compte Google ; la découverte ne
      // s'en sert pas, seul `name` compte.
      type: "PERSONAL" as const,
    }));
  }

  async listLocations(accountId: string): Promise<GbpLocation[]> {
    const account = await accountFor(accountId);
    // Énumération pure : la liste plate est déjà chargée par
    // `resolveAccounts` (1 appel, mis en cache). Aucun appel par fiche
    // ici — c'est ce qui coûtait 29 requêtes pour 3 mandats.
    return account.locations.map(summaryToLocation);
  }

  async getLocation(
    accountId: string,
    locationName: string,
  ): Promise<GbpLocation> {
    const account = await accountFor(accountId);
    const id = bareLocationId(locationName);
    const summary = account.locations.find((entry) => entry.id === id);

    const details = await parseOrThrow<ZernioLocationDetails>(
      await zernioFetch(
        `/accounts/${account.zernioAccountId}/gmb-location-details?locationId=${id}`,
      ),
      "zernio.gmb-location-details",
    );

    // Le détail relaie le payload Business Information de Google ; la
    // liste plate sert de filet quand un champ manque.
    return {
      name: `locations/${id}`,
      title: details.title ?? summary?.name ?? id,
      storefrontAddress:
        details.storefrontAddress ??
        (summary?.address ? { addressLines: [summary.address] } : undefined),
      categories:
        details.categories ??
        (summary?.category
          ? { primaryCategory: { displayName: summary.category } }
          : undefined),
      phoneNumbers: details.phoneNumbers,
      websiteUri: details.websiteUri ?? summary?.websiteUrl,
      // Relayé tel quel : c'est la matière du préremplissage du wizard.
      profile: details.profile,
      regularHours: details.regularHours,
      openInfo: details.openInfo,
      serviceItems: details.serviceItems,
    } satisfies GbpLocation;
  }

  /**
   * Catalogue des attributs proposés pour une catégorie.
   *
   * Vérifié le 2026-09-24 : 34 entrées pour « Marketing agency », déjà
   * traduites (`displayName`, `groupDisplayName`). C'est ce qui permet
   * de cocher « géré par une femme » ou de poser un lien LinkedIn depuis
   * le wizard, au lieu d'une case à cocher qui renvoie chez Google.
   */
  async listAttributeMetadata(
    accountId: string,
    locationName: string,
    categoryName: string,
  ): Promise<GbpAttributeMeta[]> {
    const account = await accountFor(accountId || locationName);
    const url =
      `/accounts/${account.zernioAccountId}/gmb-attribute-metadata` +
      `?categoryName=${encodeURIComponent(categoryName)}` +
      `&regionCode=CA&languageCode=fr`;
    const json = await parseOrThrow<{
      attributeMetadata?: Array<GbpAttributeMeta & { parent?: string }>;
    }>(await zernioFetch(url), "zernio.gmb-attribute-metadata");
    // Zernio nomme la clé `parent` ; l'app raisonne en `name`.
    return (json.attributeMetadata ?? []).map((entry) => ({
      ...entry,
      name: entry.name ?? entry.parent ?? "",
    }));
  }

  /**
   * Vérifié le 2026-09-24 sur la fiche de Küa : 4 médias rendus, avec
   * `googleUrl` et `thumbnailUrl` directement affichables. L'app ne les
   * recopie pas — elle pointe vers les originaux de Google.
   */
  async listMedia(
    accountId: string,
    locationName: string,
  ): Promise<GbpMediaItem[]> {
    const account = await accountFor(accountId || locationName);
    const json = await parseOrThrow<{
      mediaItems?: Array<{
        name: string;
        googleUrl?: string;
        thumbnailUrl?: string;
        createTime?: string;
        locationAssociation?: { category?: string };
      }>;
    }>(
      await zernioFetch(
        `/accounts/${account.zernioAccountId}/gmb-media?locationId=${bareLocationId(locationName)}`,
      ),
      "zernio.gmb-media",
    );
    return (json.mediaItems ?? [])
      .filter((item) => item.googleUrl)
      .map((item) => ({
        name: item.name,
        category: item.locationAssociation?.category ?? "ADDITIONAL",
        googleUrl: item.googleUrl!,
        thumbnailUrl: item.thumbnailUrl,
        createTime: item.createTime,
      }));
  }

  async getAttributes(
    accountId: string,
    locationName: string,
  ): Promise<GbpAttributeValue[]> {
    const account = await accountFor(accountId || locationName);
    const json = await parseOrThrow<{ attributes?: GbpAttributeValue[] }>(
      await zernioFetch(
        `/accounts/${account.zernioAccountId}/gmb-attributes?locationId=${bareLocationId(locationName)}`,
      ),
      "zernio.gmb-attributes",
    );
    return json.attributes ?? [];
  }

  async updateAttributes(
    accountId: string,
    locationName: string,
    attributes: GbpAttributeValue[],
  ): Promise<void> {
    if (!attributes.length) return;
    const account = await accountFor(accountId || locationName);
    // `attributeMask` dit quoi écrire : sans lui, Google efface tout ce
    // qui n'est pas dans la charge utile.
    const attributeMask = attributes.map((a) => a.name).join(",");
    await parseOrThrow(
      await zernioFetch(
        `/accounts/${account.zernioAccountId}/gmb-attributes?locationId=${bareLocationId(locationName)}`,
        {
          method: "PUT",
          body: JSON.stringify({ attributeMask, attributes }),
        },
      ),
      "zernio.gmb-attributes.update",
    );
  }

  async batchGetReviews(
    accountId: string,
    locationNames: string[],
    pageToken?: string,
  ): Promise<ReviewsPage> {
    const account = await accountFor(accountId);

    // Zernio rejette (400) tout nom qui n'est pas complet.
    const names = locationNames.map((name) =>
      name.startsWith("accounts/")
        ? name
        : `${accountId}/${name.startsWith("locations/") ? name : `locations/${bareLocationId(name)}`}`,
    );

    const json = await parseOrThrow<{
      locationReviews?: Array<{
        name: string;
        review?: ReviewsPage["locationReviews"][number]["reviews"][number];
      }>;
      nextPageToken?: string;
    }>(
      await zernioFetch(
        `/accounts/${account.zernioAccountId}/gmb-reviews/batch`,
        {
          method: "POST",
          body: JSON.stringify({
            locationNames: names,
            pageSize: 50,
            ...(pageToken ? { pageToken } : {}),
          }),
        },
      ),
      "zernio.gmb-reviews.batch",
    );

    // Réponse aplatie, exactement comme la v4 : une entrée par review.
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
    const account = await accountFor(reviewName);
    const response = await zernioFetch(
      `/inbox/reviews/${encodeURIComponent(reviewName)}/reply`,
      {
        method: "POST",
        body: JSON.stringify({
          accountId: account.zernioAccountId,
          message: comment,
        }),
      },
    );
    await parseOrThrow(response, "zernio.reviews.reply");
  }

  async deleteReviewReply(reviewName: string): Promise<void> {
    const account = await accountFor(reviewName);
    const response = await zernioFetch(
      `/inbox/reviews/${encodeURIComponent(reviewName)}/reply`,
      {
        method: "DELETE",
        // `accountId` va dans le CORPS, même en DELETE. En query, Zernio
        // répond 400 « missing_required_field ». Vérifié en production
        // le 2026-09-24 : une réponse de test est restée en ligne parce
        // que le retrait échouait — le seul moyen de le savoir était
        // d'écrire pour de vrai, puis d'essayer de défaire.
        body: JSON.stringify({ accountId: account.zernioAccountId }),
      },
    );
    await parseOrThrow(response, "zernio.reviews.deleteReply");
  }

  async createLocalPost(
    locationName: string,
    post: LocalPostInput,
  ): Promise<{ name: string; state: LocalPostState }> {
    const account = await accountFor(locationName);

    const json = await parseOrThrow<{
      _id?: string;
      id?: string;
      platforms?: Array<{ platform?: string; status?: string; error?: string }>;
    }>(
      await zernioFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          content: post.summary,
          ...(post.media?.length
            ? {
                mediaItems: post.media.map((item) => ({
                  type: "image",
                  url: item.sourceUrl,
                })),
              }
            : {}),
          platforms: [
            {
              platform: "googlebusiness",
              accountId: account.zernioAccountId,
              platformSpecificData: {
                locationId: `locations/${bareLocationId(locationName)}`,
                ...(post.callToAction
                  ? {
                      callToAction: {
                        type: post.callToAction.actionType,
                        ...(post.callToAction.url
                          ? { url: post.callToAction.url }
                          : {}),
                      },
                    }
                  : {}),
              },
            },
          ],
          publishNow: true,
        }),
      }),
      "zernio.posts.create",
    );

    const result = json.platforms?.find(
      (entry) => entry.platform === "googlebusiness",
    );
    if (result?.status === "failed") {
      throw new GbpApiError(
        `Publication refusée par Zernio : ${result.error ?? "raison inconnue"}`,
        502,
      );
    }

    // ⚠️ Zernio ne documente aucun statut de modération Google. Un post
    // rejeté APRÈS coup ne redescendra donc pas ici — contrairement à la
    // v4, qui renvoyait REJECTED. On ne prétend pas le savoir : tout
    // envoi accepté est rapporté LIVE.
    return {
      name: `${locationName}/localPosts/${json._id ?? json.id ?? "inconnu"}`,
      state: "LIVE",
    };
  }

  /**
   * Retire une publication de la fiche Google.
   *
   * Découvert en testant pour de vrai le 2026-09-24 : `DELETE /posts/{id}`
   * refuse un post publié (« Published posts cannot be deleted ») — il ne
   * sert qu'aux brouillons et aux planifiés. Le retrait côté Google passe
   * par `unpublish`, qui répond « Post deleted from googlebusiness
   * successfully ». On supprime ensuite l'enregistrement, devenu
   * `cancelled`, pour ne pas laisser de trace chez Zernio.
   *
   * Ni la doc ni l'intuition ne donnaient ce chemin : le `DELETE` semblait
   * évident et se contentait d'échouer.
   */
  async deleteLocalPost(postName: string): Promise<void> {
    // `createLocalPost` renvoie « {location}/localPosts/{id Zernio} » :
    // la fiche se lit avant `localPosts`, l'identifiant après. Passer le
    // nom entier à `accountFor` lui faisait chercher une fiche portant
    // l'id du post.
    const [locationPart, postId] = postName.split("/localPosts/");
    if (!postId) {
      throw new Error(
        `Nom de publication inattendu : ${postName} — « {fiche}/localPosts/{id} » attendu.`,
      );
    }
    const account = await accountFor(locationPart);

    await parseOrThrow(
      await zernioFetch(`/posts/${postId}/unpublish`, {
        method: "POST",
        body: JSON.stringify({
          platform: "googlebusiness",
          accountId: account.zernioAccountId,
        }),
      }),
      "zernio.posts.unpublish",
    );

    // Le post est retiré de Google ; l'enregistrement restant est du
    // ménage — son échec ne doit pas faire croire que le retrait a raté.
    const cleanup = await zernioFetch(`/posts/${postId}`, { method: "DELETE" });
    if (!cleanup.ok) {
      console.error(
        `Post retiré de Google mais enregistrement Zernio ${postId} conservé (${cleanup.status}).`,
      );
    }
  }

  async updateLocation(
    locationName: string,
    patch: Record<string, unknown>,
    updateMask: string,
  ): Promise<void> {
    const account = await accountFor(locationName);
    const response = await zernioFetch(
      `/accounts/${account.zernioAccountId}/gmb-location-details?locationId=${bareLocationId(locationName)}`,
      {
        method: "PUT",
        // `updateMask` voyage DANS le corps chez Zernio, pas en query
        // comme chez Google.
        body: JSON.stringify({ updateMask, ...patch }),
      },
    );
    await parseOrThrow(response, "zernio.gmb-location-details.update");
  }
}
