import "server-only";

// Génération d'images de posts (specs/06 §Images AI).
// Providers par ordre de priorité : OpenAI (gpt-image-1) puis Gemini.
// Abstrait derrière ce module pour pouvoir changer de provider.
// Sans aucune clé : retourne null → le post reste en draft avec
// badge « image à ajouter ».

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const TIMEOUT_MS = 60_000;

/**
 * OpenAI Images API. gpt-image-1 (le modèle d'images de ChatGPT) exige
 * une organisation vérifiée sur platform.openai.com — sinon 403, et on
 * retombe sur Gemini. Retourne du base64 (pas d'URL) par défaut.
 */
async function openaiImage(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const body = JSON.stringify({
    model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL,
    prompt: `${prompt}. Landscape orientation, photorealistic, high quality.`,
    // Seul format paysage de gpt-image-1 (3:2) — sharp recadre en 1200×900.
    size: "1536x1024",
    // « medium » ≈ 0,06 $/image; « high » ≈ 0,25 $ — garder le contrôle du coût.
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    n: 1,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(OPENAI_IMAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error(
          `OpenAI image ${response.status}:`,
          await response.text(),
        );
        if (response.status < 500) break; // 4xx (org non vérifiée…) : inutile de retenter
        continue;
      }

      const json = (await response.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const b64 = json.data?.[0]?.b64_json;
      if (b64) {
        return Buffer.from(b64, "base64");
      }
      console.error("OpenAI image : réponse sans image.");
    } catch (error) {
      console.error("OpenAI image :", error);
    }
  }
  return null;
}

async function geminiImage(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: `${prompt}. Aspect ratio 4:3, landscape orientation, photorealistic, high quality.`,
          },
        ],
      },
    ],
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error(`Gemini image ${response.status}:`, await response.text());
        continue;
      }

      const json = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
          };
        }>;
      };
      const inline = json.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data,
      )?.inlineData;
      if (inline?.data) {
        return Buffer.from(inline.data, "base64");
      }
      console.error("Gemini image : réponse sans image.");
    } catch (error) {
      console.error("Gemini image :", error);
    }
  }
  return null;
}

/**
 * Génère une image depuis le prompt (anglais, photographique).
 * 2 tentatives par provider (specs/06); retourne null si aucune clé
 * ou échec final de tous les providers.
 */
export async function generatePostImage(
  prompt: string,
): Promise<Buffer | null> {
  return (await openaiImage(prompt)) ?? (await geminiImage(prompt));
}
