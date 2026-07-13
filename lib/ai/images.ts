import "server-only";

// Génération d'images de posts (specs/06 §Images AI).
// Providers par ordre de priorité : OpenAI (gpt-image-1) puis Gemini.
// Abstrait derrière ce module pour pouvoir changer de provider.
// Sans aucune clé : retourne null → le post reste en draft avec
// badge « image à ajouter ».

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
// gpt-image-1.5 : le flagship image d'OpenAI (gpt-image-1 s'éteint en
// oct. 2026) — meilleure qualité ET ~20 % moins cher. gpt-image-2 existe
// mais son API est différente (asynchrone, polling) — pas un drop-in.
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5";
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const TIMEOUT_MS = 60_000;

// Garde-fous appliqués à TOUTE image (génération initiale, régénération
// avec directive) — au niveau provider, pas au bon vouloir du LLM qui
// rédige le prompt de scène. Objectif : une photo qui passe pour une
// vraie photo de terrain, jamais pour du contenu généré par IA.
const IMAGE_STYLE =
  "Candid documentary-style photograph, as if taken on-site by a " +
  "professional photographer with a DSLR and a 35mm lens. Natural ambient " +
  "lighting, realistic textures and materials, natural muted color " +
  "grading, believable depth of field, authentic real-world imperfections.";
const IMAGE_CONSTRAINTS =
  "STRICT RULES: absolutely no text of any kind — no letters, words, " +
  "numbers, readable signage, labels, captions or watermarks. No logos, " +
  "no brand names, no branded products, vehicles or uniforms. No close-up " +
  "human faces. Nothing staged, oversaturated, overly clean, plastic-" +
  "looking or otherwise recognizable as AI-generated or stock photography.";

/** Prompt final envoyé aux providers : scène + style réaliste + interdits. */
export function finalizeImagePrompt(scene: string): string {
  return `${scene.trim().replace(/\.+$/, "")}. ${IMAGE_STYLE} ${IMAGE_CONSTRAINTS}`;
}

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
    prompt: `${prompt} Landscape orientation.`,
    // Seul format paysage de gpt-image-1 (3:2) — sharp recadre en 1200×900.
    size: "1536x1024",
    // « high » ≈ 0,20 $/image sur gpt-image-1.5 — assumé : l'image EST le
    // livrable du post, et le volume mensuel reste faible (1-3/client).
    // OPENAI_IMAGE_QUALITY=medium en env pour redescendre au besoin.
    quality: process.env.OPENAI_IMAGE_QUALITY || "high",
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
            text: `${prompt} Aspect ratio 4:3, landscape orientation.`,
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
  const full = finalizeImagePrompt(prompt);
  return (await openaiImage(full)) ?? (await geminiImage(full));
}
