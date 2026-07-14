import { describe, expect, it } from "vitest";
import {
  buildGrid,
  DEFAULT_SPACING_KM,
  GEOGRID_SIZE,
  gridAggregates,
  mockScanRanks,
  normalizeBusinessTitle,
} from "./grid";

const CENTER = { lat: 45.639, lng: -73.846 }; // Sainte-Thérèse

describe("buildGrid", () => {
  const grid = buildGrid(CENTER.lat, CENTER.lng);

  it("7×7 = 49 points, le centre au milieu", () => {
    expect(grid).toHaveLength(GEOGRID_SIZE * GEOGRID_SIZE);
    const center = grid[Math.floor(grid.length / 2)];
    expect(center.lat).toBeCloseTo(CENTER.lat, 5);
    expect(center.lng).toBeCloseTo(CENTER.lng, 5);
  });

  it("espacement ~spacing_km entre lignes (latitude)", () => {
    const rowStepDeg = Math.abs(grid[0].lat - grid[GEOGRID_SIZE].lat);
    expect(rowStepDeg * 111.32).toBeCloseTo(DEFAULT_SPACING_KM, 1);
  });

  it("ordonné nord → sud, ouest → est", () => {
    expect(grid[0].lat).toBeGreaterThan(grid.at(-1)!.lat);
    expect(grid[0].lng).toBeLessThan(grid[GEOGRID_SIZE - 1].lng);
  });
});

describe("gridAggregates", () => {
  it("moyenne/meilleur/présence sur les points trouvés", () => {
    const result = gridAggregates([
      { lat: 0, lng: 0, rank: 1 },
      { lat: 0, lng: 1, rank: 4 },
      { lat: 0, lng: 2, rank: null },
    ]);
    expect(result).toEqual({ avgRank: 2.5, bestRank: 1, foundCount: 2 });
  });

  it("aucun point trouvé", () => {
    expect(gridAggregates([{ lat: 0, lng: 0, rank: null }])).toEqual({
      avgRank: null,
      bestRank: null,
      foundCount: 0,
    });
  });
});

describe("normalizeBusinessTitle", () => {
  it("accents, casse, ponctuation", () => {
    expect(normalizeBusinessTitle("Toitures Bergeron Inc.")).toBe(
      "toitures bergeron inc",
    );
    expect(normalizeBusinessTitle("Électricité Sainte-Thérèse")).toBe(
      normalizeBusinessTitle("electricite sainte therese"),
    );
  });
});

describe("mockScanRanks", () => {
  const points = buildGrid(CENTER.lat, CENTER.lng);

  it("déterministe (même seed → mêmes rangs)", () => {
    const a = mockScanRanks("seed", points, CENTER.lat, CENTER.lng);
    const b = mockScanRanks("seed", points, CENTER.lat, CENTER.lng);
    expect(a).toEqual(b);
  });

  it("meilleur au centre qu'aux coins", () => {
    const ranks = mockScanRanks("seed", points, CENTER.lat, CENTER.lng);
    const center = ranks[Math.floor(ranks.length / 2)];
    const corner = ranks[0];
    expect(center.rank).not.toBeNull();
    expect(corner.rank === null || corner.rank > center.rank!).toBe(true);
  });
});
