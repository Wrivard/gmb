// Texte d'avis tel qu'il vaut la peine d'être lu.
//
// Google traduit les avis et renvoie les DEUX versions dans un seul
// champ : « (Translated by Google) <traduction> (Original) <texte> ».
// La file affichait donc chaque avis deux fois, l'anglais d'abord —
// alors que l'équipe et la clientèle sont francophones et que c'est
// l'original qu'on répond.
//
// Pas de "server-only" : utilisé par la file (client) et testé seul.

const TRANSLATED = /^\s*\((?:Translated by Google|Traduit par Google)\)[\s\S]*?\((?:Original|Originale?)\)\s*([\s\S]+)$/i;

/** L'original quand Google a préfixé une traduction ; le texte tel quel sinon. */
export function originalComment(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const match = TRANSLATED.exec(comment);
  return (match ? match[1] : comment).trim() || null;
}
