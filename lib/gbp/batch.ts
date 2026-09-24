/**
 * `batchGetReviews` accepte au plus 50 fiches par requête — même limite
 * chez Google v4 et chez Zernio, et au-delà c'est un 400 sec. Küa en a
 * 29 aujourd'hui : sans découpage, la synchro casserait au 51e client,
 * silencieusement, un matin.
 */
export const REVIEW_BATCH_SIZE = 50;

export function chunkLocationNames(
  names: string[],
  size: number = REVIEW_BATCH_SIZE,
): string[][] {
  if (size < 1) throw new Error("Taille de lot invalide.");
  const batches: string[][] = [];
  for (let index = 0; index < names.length; index += size) {
    batches.push(names.slice(index, index + size));
  }
  return batches;
}
