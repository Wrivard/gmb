import { describe, expect, it } from "vitest";
import { GBP_DESCRIPTION_MAX, GBP_REVIEW_BATCH_MAX } from "./limits";
import { REVIEW_BATCH_SIZE } from "./batch";

// Ces valeurs viennent d'écritures réelles, pas de la doc. Les figer
// évite qu'un « arrondi » plausible les remplace.
describe("limites Google constatées", () => {
  it("description : 750 caractères", () => {
    expect(GBP_DESCRIPTION_MAX).toBe(750);
  });

  it("le lot d'avis partage la limite utilisée par le découpage", () => {
    expect(GBP_REVIEW_BATCH_MAX).toBe(REVIEW_BATCH_SIZE);
  });
});
