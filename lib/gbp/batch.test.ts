import { describe, expect, it } from "vitest";
import { REVIEW_BATCH_SIZE, chunkLocationNames } from "./batch";

const names = (count: number) =>
  Array.from({ length: count }, (_, index) => `locations/${index}`);

describe("chunkLocationNames", () => {
  it("laisse un lot intact sous la limite", () => {
    expect(chunkLocationNames(names(29))).toHaveLength(1);
  });

  it("découpe au-delà de 50 — la synchro cassait au 51e client", () => {
    const batches = chunkLocationNames(names(51));
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(1);
  });

  it("n'oublie aucune fiche et garde l'ordre", () => {
    const input = names(120);
    expect(chunkLocationNames(input).flat()).toEqual(input);
  });

  it("rend une liste vide sans fiche — pas un lot vide", () => {
    expect(chunkLocationNames([])).toEqual([]);
  });

  it("la limite documentée est bien celle de Google et Zernio", () => {
    expect(REVIEW_BATCH_SIZE).toBe(50);
  });
});
