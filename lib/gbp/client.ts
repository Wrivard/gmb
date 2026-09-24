import "server-only";

import type {
  GbpAccount,
  GbpAttributeMeta,
  GbpAttributeValue,
  GbpLocation,
  GbpMediaItem,
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
  /**
   * Énumère les fiches d'un compte. Contrat volontairement modeste :
   * identité + ce que le fournisseur donne gratuitement. Chez Zernio la
   * liste plate ne porte pas le téléphone — payer un appel de détail par
   * fiche pour 29 fiches dont 3 sont suivies était le coût principal de
   * l'intégration. Pour un profil complet, voir `getLocation`.
   */
  listLocations(accountId: string): Promise<GbpLocation[]>;
  /** Profil complet d'UNE fiche (un appel), pour l'import et le refresh. */
  getLocation(accountId: string, locationName: string): Promise<GbpLocation>;
  /** Catalogue des attributs proposés pour une catégorie donnée. */
  listAttributeMetadata(
    accountId: string,
    locationName: string,
    categoryName: string,
  ): Promise<GbpAttributeMeta[]>;
  /** Photos déjà publiées sur la fiche — lecture seule. */
  listMedia(accountId: string, locationName: string): Promise<GbpMediaItem[]>;
  /**
   * Publie une photo sur la fiche depuis une URL publique. Google va
   * chercher l'image lui-même : elle doit être joignable sans
   * authentification (le bucket de l'app l'est).
   */
  uploadMedia(
    accountId: string,
    locationName: string,
    sourceUrl: string,
    category: string,
  ): Promise<GbpMediaItem>;
  /** Retire une photo de la fiche. */
  deleteMedia(
    accountId: string,
    locationName: string,
    mediaId: string,
  ): Promise<void>;
  /** Attributs actuellement posés sur la fiche. */
  getAttributes(
    accountId: string,
    locationName: string,
  ): Promise<GbpAttributeValue[]>;
  /** Écrit les attributs listés dans `attributeMask`. */
  updateAttributes(
    accountId: string,
    locationName: string,
    attributes: GbpAttributeValue[],
  ): Promise<void>;
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
