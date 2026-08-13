// Normalisation des identifiants de ressource Google Business Profile.
//
// Contexte : tant que le quota d'Account Management et de Business
// Information reste à zéro, la découverte automatique ne peut pas
// tourner. Les identifiants se saisissent donc à la main — et personne
// ne les recopie sous la forme exacte que veut l'API. On accepte les
// formes que les gens ont réellement sous les yeux (identifiant nu,
// nom de ressource complet, URL du tableau de bord Google) et on rend
// toujours la forme canonique `accounts/123` ou `locations/456`.
//
// L'enjeu n'est pas cosmétique : un identifiant mal formé publie chez
// le mauvais commerce, ou échoue avec une erreur illisible.

export type GbpResourceKind = "accounts" | "locations";

/**
 * Rend `accounts/123` / `locations/456`, ou null si rien d'exploitable.
 * Un nom de ressource complet (`accounts/1/locations/2`) est découpé
 * selon le type demandé — c'est le piège principal : prendre le dernier
 * nombre donnerait l'identifiant de fiche là où on veut celui du compte.
 */
export function normalizeGbpResourceId(
  input: string,
  kind: GbpResourceKind,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Le segment est nommé quelque part dans la chaîne : il fait foi.
  const named = new RegExp(`${kind}/(\\d+)`).exec(trimmed);
  if (named) return `${kind}/${named[1]}`;

  // 2. Identifiant nu, recopié seul.
  if (/^\d+$/.test(trimmed)) return `${kind}/${trimmed}`;

  // 3. Collé depuis une URL du tableau de bord Google : on prend le
  //    dernier nombre long, les URLs plaçant l'identifiant en fin.
  const numbers = trimmed.match(/\d{6,}/g);
  if (numbers?.length) return `${kind}/${numbers[numbers.length - 1]}`;

  return null;
}

/** Nom de ressource complet attendu par l'API v4 (avis, publications). */
export function gbpLocationPath(
  accountId: string,
  locationId: string,
): string {
  return `${accountId}/${locationId}`;
}
