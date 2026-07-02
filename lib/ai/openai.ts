import "server-only";

// Appels texte à l'API OpenAI (décision #9 : OpenAI, pas Anthropic).
// Chat Completions en fetch natif : timeout 30 s, 1 retry sur erreur
// réseau/5xx (specs/07 §Coûts et robustesse).

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
const TIMEOUT_MS = 30_000;

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openaiModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export class AiApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  usage: ChatUsage | null;
}

export async function chatText(options: {
  system: string;
  user: string;
  temperature: number;
  maxTokens?: number;
}): Promise<ChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiApiError("OPENAI_API_KEY manquante.");
  }

  const body = JSON.stringify({
    model: openaiModel(),
    temperature: options.temperature,
    max_tokens: options.maxTokens ?? 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.status >= 500) {
        lastError = new AiApiError(
          `OpenAI ${response.status}`,
          response.status,
        );
        continue; // retry sur 5xx
      }
      if (!response.ok) {
        throw new AiApiError(
          `OpenAI ${response.status}: ${await response.text()}`,
          response.status,
        );
      }

      const json = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: ChatUsage;
      };
      const text = json.choices?.[0]?.message?.content;
      if (!text) {
        throw new AiApiError("Réponse OpenAI sans contenu.");
      }
      return {
        text,
        model: json.model ?? openaiModel(),
        usage: json.usage ?? null,
      };
    } catch (error) {
      if (error instanceof AiApiError && error.status && error.status < 500) {
        throw error; // 4xx : inutile de retenter
      }
      lastError = error; // réseau / timeout / 5xx → 1 retry
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AiApiError("Échec de l'appel OpenAI.");
}
