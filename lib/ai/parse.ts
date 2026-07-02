// Parsing défensif des sorties JSON des modèles (specs/07) :
// strip des fences markdown, extraction du premier objet, try/catch.

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

/**
 * Extrait et parse le premier objet JSON d'une sortie de modèle.
 * Tolère les fences ```json ... ``` et le texte parasite autour.
 */
export function parseJsonObject<T>(raw: string): T {
  let text = raw.trim();

  // Fences markdown : ```json ... ``` ou ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Texte parasite autour : isoler du premier `{` au dernier `}`.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new AiParseError("Aucun objet JSON dans la sortie du modèle.");
  }

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new AiParseError("JSON invalide dans la sortie du modèle.");
  }
}

/** Parse une réponse de review : {"reply": "..."} avec reply non vide. */
export function parseReplyOutput(raw: string): string {
  const parsed = parseJsonObject<{ reply?: unknown }>(raw);
  if (typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    throw new AiParseError("Champ `reply` manquant ou vide.");
  }
  return parsed.reply.trim();
}
