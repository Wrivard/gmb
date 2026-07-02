import "server-only";

// Génération du contenu des posts mensuels (specs/06 + 07).
// Sans OPENAI_API_KEY : stub saisonnier déterministe pour le mode démo.

import { logActivity } from "@/lib/activity";
import { torontoParts } from "@/lib/due";
import type { BrandProfile, Client, CtaType } from "@/lib/types/database";
import { chatText, openaiConfigured } from "./openai";
import { AiParseError, parseJsonObject } from "./parse";

export interface PostContent {
  summary: string;
  ctaType: Extract<CtaType, "LEARN_MORE" | "CALL">;
  imagePrompt: string;
  angle: string;
  generatedByAi: boolean;
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function seasonFr(month: number): string {
  if (month === 12 || month <= 3) return "hiver";
  if (month <= 5) return "printemps";
  if (month <= 8) return "été";
  return "automne";
}

function buildPostSystemPrompt(
  client: Pick<Client, "name" | "brand_profile">,
  recentSummaries: string[],
  now: Date,
): string {
  const profile: BrandProfile = client.brand_profile ?? {};
  const { month } = torontoParts(now);

  return `Tu es le stratège de contenu local de ${client.name} (${profile.vertical ?? "services"}, ${profile.city ?? "Québec"}, Québec).
Tu rédiges une publication Google Business Profile (Local Post).

PROFIL : ${JSON.stringify(profile)}
CONTEXTE : Nous sommes en ${MONTHS_FR[month - 1]} ${torontoParts(now).year}. Saison : ${seasonFr(month)}.
DERNIERS POSTS (ne répète NI l'angle NI les formulations) :
${recentSummaries.length ? recentSummaries.map((s) => `- ${s}`).join("\n") : "(aucun)"}

RÈGLES
1. Français québécois naturel. 80 à 200 mots. Maximum absolu 1400 caractères.
2. Choisis UN angle différent des derniers posts : conseil saisonnier lié au métier / service mis de l'avant / pourquoi choisir cette entreprise / rappel pratique / réalité du métier ce mois-ci au Québec.
3. Structure : accroche concrète → valeur réelle pour le lecteur (pas du remplissage) → invitation douce à l'action.
4. Ton : ${profile.tone ?? "chaleureux et professionnel"}. Maximum 2 émojis, zéro hashtag. Aucun prix, aucune promotion, aucune date d'événement inventés.
5. Génère aussi un prompt d'image EN ANGLAIS pour un modèle de génération d'image : photo réaliste, liée au sujet du post et à la saison québécoise, esthétique premium sobre, lumière naturelle, SANS texte incrusté, sans logo, sans visage en gros plan.

Réponds UNIQUEMENT avec ce JSON :
{"summary": "...", "cta_type": "LEARN_MORE|CALL", "image_prompt": "...", "angle": "..."}`;
}

function stubPostContent(
  client: Pick<Client, "name" | "website" | "brand_profile">,
  now: Date,
): PostContent {
  const profile: BrandProfile = client.brand_profile ?? {};
  const { month } = torontoParts(now);
  const season = seasonFr(month);
  const vertical = profile.vertical ?? "nos services";
  const city = profile.city ?? "la région";

  return {
    summary: `L'${season} est là — le bon moment pour penser à ${vertical} à ${city}. Chez ${client.name}, on prend le temps de bien faire les choses : ${(profile.services_cles ?? ["un service fiable"]).slice(0, 2).join(" et ")}, avec ${(profile.arguments ?? ["une équipe d'expérience"])[0]}. Contactez-nous pour en discuter — ça nous fera plaisir de vous conseiller. ${profile.signature ?? `L'équipe ${client.name}`}`,
    ctaType: client.website ? "LEARN_MORE" : "CALL",
    imagePrompt: `Realistic photo related to ${vertical} in Quebec during ${season}, premium sober aesthetic, natural light, no text, no logo`,
    angle: `conseil saisonnier (${season})`,
    generatedByAi: false,
  };
}

function parsePostOutput(raw: string): Omit<PostContent, "generatedByAi"> {
  const parsed = parseJsonObject<{
    summary?: unknown;
    cta_type?: unknown;
    image_prompt?: unknown;
    angle?: unknown;
  }>(raw);

  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) {
    throw new AiParseError("Champ `summary` manquant.");
  }
  if (parsed.summary.length > 1500) {
    throw new AiParseError("`summary` dépasse la limite de 1500 caractères.");
  }
  const ctaType = parsed.cta_type === "CALL" ? "CALL" : "LEARN_MORE";
  if (typeof parsed.image_prompt !== "string" || !parsed.image_prompt.trim()) {
    throw new AiParseError("Champ `image_prompt` manquant.");
  }

  return {
    summary: parsed.summary.trim(),
    ctaType,
    imagePrompt: parsed.image_prompt.trim(),
    angle: typeof parsed.angle === "string" ? parsed.angle.trim() : "",
  };
}

export async function generatePostContent(options: {
  client: Pick<
    Client,
    "id" | "agency_id" | "name" | "website" | "brand_profile"
  >;
  recentSummaries: string[];
  now?: Date;
}): Promise<PostContent> {
  const { client } = options;
  const now = options.now ?? new Date();

  if (!openaiConfigured()) {
    return stubPostContent(client, now);
  }

  const system = buildPostSystemPrompt(client, options.recentSummaries, now);
  const user = "Rédige la publication du mois.";

  // 1 retry si la sortie n'est pas le JSON attendu (specs/07).
  let result = await chatText({ system, user, temperature: 0.7 });
  let content: Omit<PostContent, "generatedByAi">;
  try {
    content = parsePostOutput(result.text);
  } catch {
    result = await chatText({ system, user, temperature: 0.7 });
    content = parsePostOutput(result.text);
  }

  await logActivity({
    agencyId: client.agency_id,
    clientId: client.id,
    actor: "ai",
    action: "generation",
    payload: {
      type: "post",
      model: result.model,
      prompt_tokens: result.usage?.prompt_tokens ?? null,
      completion_tokens: result.usage?.completion_tokens ?? null,
    },
  });

  return { ...content, generatedByAi: true };
}
