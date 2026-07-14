// Kit d'avis (palier 1) — helpers purs de la page publique « Demander
// un avis » : rendu du gabarit de message et lien sms: pré-rempli.
// Le SMS part du téléphone du contracteur (person-to-person) : aucun
// envoi serveur, aucun enjeu LCAP. Pas de "server-only" : consommé par
// la page publique (client).

import type { ReviewKitData } from "@/lib/types/database";

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
