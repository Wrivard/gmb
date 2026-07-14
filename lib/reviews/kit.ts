// Kit d'avis (palier 1) — helpers purs de la page publique « Demander
// un avis » : rendu du gabarit de message et lien sms: pré-rempli.
// Le SMS part du téléphone du contracteur (person-to-person) : aucun
// envoi serveur, aucun enjeu LCAP. Pas de "server-only" : consommé par
// la page publique (client).

import type { ReviewKitData } from "@/lib/types/database";

export const REVIEW_MESSAGE_MAX = 500;

export type NormalizedReviewKit =
  | { ok: true; kit: ReviewKitData }
  | { ok: false; error: string };

/**
 * Trim + règles du kit — LA source des règles, partagée par le panneau
 * (garde-fou UI) et la server action (garde-fou réel). Les champs vides
 * disparaissent (vide = gabarit par défaut / lien non configuré).
 */
export function normalizeReviewKit(input: ReviewKitData): NormalizedReviewKit {
  const link = input.review_link?.trim();
  const message = input.message?.trim();
  if (link && !/^https:\/\//.test(link)) {
    return {
      ok: false,
      error:
        "Le lien d'avis doit être une URL https (g.page/r/… ou search.google.com/local/writereview…).",
    };
  }
  if ((message?.length ?? 0) > REVIEW_MESSAGE_MAX) {
    return {
      ok: false,
      error: `Gabarit trop long (max ${REVIEW_MESSAGE_MAX} caractères) — un texto, pas une lettre.`,
    };
  }
  return {
    ok: true,
    kit: {
      ...(link ? { review_link: link } : {}),
      ...(message ? { message } : {}),
    },
  };
}

/** Gabarit par défaut — placeholders {prenom}, {entreprise}, {lien}. */
export function defaultReviewMessage(): string {
  return (
    "Bonjour {prenom}! Merci d'avoir fait confiance à {entreprise}. " +
    "Si vous êtes satisfait du travail, un petit avis Google nous aiderait " +
    "énormément — deux phrases suffisent : {lien}\nMerci!"
  );
}

/**
 * Rend le message à envoyer. Sans prénom, le placeholder disparaît
 * proprement (« Bonjour {prenom}! » → « Bonjour! »).
 */
export function renderReviewMessage(
  kit: ReviewKitData,
  input: { businessName: string; firstName?: string },
): string {
  const template = kit.message?.trim() || defaultReviewMessage();
  const firstName = input.firstName?.trim();
  const withName = firstName
    ? template.replaceAll("{prenom}", firstName)
    : template.replaceAll(" {prenom}", "").replaceAll("{prenom}", "");
  return withName
    .replaceAll("{entreprise}", input.businessName)
    .replaceAll("{lien}", kit.review_link?.trim() ?? "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Détection iOS pour le séparateur sms:. Safari sur iPadOS se présente
 * comme un Mac — le tactile (maxTouchPoints) le trahit.
 */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

/**
 * Lien sms: pré-rempli. iOS et Android n'utilisent pas le même
 * séparateur avant body.
 */
export function smsHref(message: string, ios: boolean): string {
  const separator = ios ? "&" : "?";
  return `sms:${separator}body=${encodeURIComponent(message)}`;
}
