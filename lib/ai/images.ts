import "server-only";

// Génération d'images de posts via Gemini (specs/06 §Images AI).
// Abstrait derrière ce module pour pouvoir changer de provider.
// Sans GEMINI_API_KEY : retourne null → le post reste en draft avec
// badge « image à ajouter ».

const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const TIMEOUT_MS = 60_000;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function imageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

/**
 * Génère une image depuis le prompt (anglais, photographique).
 * 2 tentatives (specs/06); retourne null si pas de clé ou échec final.
 */
export async function generatePostImage(
  prompt: string,
): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel()}:generateContent`;
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
