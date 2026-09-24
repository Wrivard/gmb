// Limites imposées par Google, constatées en poussant pour de vrai —
// pas lues dans une doc. Chacune se manifeste autrement par un 400
// « invalid argument » opaque, relayé en 500 par Zernio.

/**
 * Description de la fiche (`profile.description`).
 * Vérifié le 2026-09-24 sur la fiche de Küa : 737 caractères passent,
 * 775 sont refusés.
 */
export const GBP_DESCRIPTION_MAX = 750;

/** Fiches par requête `batchGetReviews` — voir lib/gbp/batch.ts. */
export const GBP_REVIEW_BATCH_MAX = 50;
