import "server-only";

// Génération des drafts de réponses aux reviews (specs/05 + 07).
// Sans OPENAI_API_KEY : stub déterministe lisible, pour que le flow
// complet reste testable en mode démo (décision #9).

import { logActivity } from "@/lib/activity";
import type { BrandProfile, Client, Review } from "@/lib/types/database";
import { chatText, openaiConfigured } from "./openai";
import { parseReplyOutput } from "./parse";
import { buildReplySystemPrompt, buildReplyUserMessage } from "./prompts";

export interface ReplyDraft {
  reply: string;
  generatedByAi: boolean;
}

function stubReply(
  client: Pick<Client, "name" | "brand_profile">,
  review: Pick<Review, "reviewer_name" | "star_rating" | "comment">,
): string {
  const profile: BrandProfile = client.brand_profile ?? {};
  const signature = profile.signature ?? `L'équipe ${client.name}`;
  const firstName = review.reviewer_name?.split(" ")[0];
  const greeting = firstName ? `Merci ${firstName}` : "Merci beaucoup";

  if (review.star_rating >= 4) {
    return `${greeting} pour votre avis! Ça fait plaisir à toute l'équipe. Au plaisir de vous revoir. — ${signature}`;
  }
  const phone = profile.phone ? ` au ${profile.phone}` : "";
  return `${greeting} d'avoir pris le temps de nous écrire. Nous sommes désolés que votre expérience n'ait pas été à la hauteur. Contactez-nous${phone} pour qu'on trouve une solution ensemble. Votre feedback nous aide à nous améliorer. — ${signature}`;
}

/**
 * Génère un draft de réponse pour une review. Ne lance jamais d'exception
 * liée à la config : sans clé OpenAI, retourne le stub.
 */
export async function generateReplyDraft(options: {
  client: Pick<Client, "id" | "agency_id" | "name" | "brand_profile">;
  review: Pick<Review, "id" | "reviewer_name" | "star_rating" | "comment">;
  directive?: string;
  previousDraft?: string;
}): Promise<ReplyDraft> {
  const { client, review } = options;

  if (!openaiConfigured()) {
    return { reply: stubReply(client, review), generatedByAi: false };
  }

  const system = buildReplySystemPrompt(client);
  const user = buildReplyUserMessage(review, {
    directive: options.directive,
    previousDraft: options.previousDraft,
  });

  // 1 retry si la sortie n'est pas le JSON attendu (specs/07).
  let result = await chatText({ system, user, temperature: 0.5 });
  let reply: string;
  try {
    reply = parseReplyOutput(result.text);
  } catch {
    result = await chatText({ system, user, temperature: 0.5 });
    reply = parseReplyOutput(result.text);
  }

  await logActivity({
    agencyId: client.agency_id,
    clientId: client.id,
    actor: "ai",
    action: "generation",
    payload: {
      type: "review_reply",
      model: result.model,
      review_id: review.id,
      prompt_tokens: result.usage?.prompt_tokens ?? null,
      completion_tokens: result.usage?.completion_tokens ?? null,
    },
  });

  return { reply, generatedByAi: true };
}
