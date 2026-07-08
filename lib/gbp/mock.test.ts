import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockGbpClient } from "./mock";
import type { LocalPostInput } from "./types";

// GBP_MOCK_FAILURES=0 : pas d'échecs aléatoires — seuls les marqueurs
// scriptables doivent décider du résultat.

function postInput(summary: string): LocalPostInput {
  return { languageCode: "fr-CA", topicType: "STANDARD", summary };
}

describe("MockGbpClient — états et échecs scriptables", () => {
  const mock = new MockGbpClient();

  beforeEach(() => {
    vi.stubEnv("GBP_MOCK_FAILURES", "0");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  async function settled<T>(promise: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return promise;
  }

  it("createLocalPost retourne LIVE sans marqueur (comportement historique)", async () => {
    const result = await settled(
      mock.createLocalPost("accounts/1/locations/2", postInput("Bonjour!")),
    );
    expect(result.state).toBe("LIVE");
    expect(result.name).toContain("accounts/1/locations/2/localPosts/");
  });

  it("[mock:rejected] force REJECTED", async () => {
    const result = await settled(
      mock.createLocalPost(
        "accounts/1/locations/2",
        postInput("Promo interdite [mock:rejected]"),
      ),
    );
    expect(result.state).toBe("REJECTED");
  });

  it("[mock:processing] force PROCESSING", async () => {
    const result = await settled(
      mock.createLocalPost(
        "accounts/1/locations/2",
        postInput("En file [mock:processing]"),
      ),
    );
    expect(result.state).toBe("PROCESSING");
  });

  it("putReviewReply échoue de façon déterministe sur [mock:fail]", async () => {
    const promise = mock.putReviewReply(
      "accounts/1/locations/2/reviews/3",
      "Merci! [mock:fail]",
    );
    promise.catch(() => {}); // évite l'unhandled rejection pendant les timers
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow("[mock:fail]");
  });

  it("putReviewReply accepte une réponse normale", async () => {
    await expect(
      settled(
        mock.putReviewReply("accounts/1/locations/2/reviews/3", "Merci!"),
      ),
    ).resolves.toBeUndefined();
  });
});
