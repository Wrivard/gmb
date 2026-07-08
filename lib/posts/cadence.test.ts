import { describe, expect, it } from "vitest";
import { monthlyCadence, torontoMonthTester } from "./cadence";
import type { CadencePostRow } from "./cadence";

// 15 juillet 2026, midi UTC (8 h à Toronto) — plein milieu de mois.
const NOW = new Date("2026-07-15T12:00:00Z");

function post(
  status: CadencePostRow["status"],
  dates: Partial<Pick<CadencePostRow, "scheduled_for" | "published_at">> = {},
): CadencePostRow {
  return {
    status,
    scheduled_for: dates.scheduled_for ?? null,
    published_at: dates.published_at ?? null,
  };
}

describe("torontoMonthTester", () => {
  const inMonth = torontoMonthTester(NOW);

  it("accepte le mois courant, rejette le voisin et null", () => {
    expect(inMonth("2026-07-01T10:00:00Z")).toBe(true);
    expect(inMonth("2026-07-31T23:00:00Z")).toBe(true);
    expect(inMonth("2026-06-30T23:00:00Z")).toBe(false);
    expect(inMonth(null)).toBe(false);
  });

  it("borne du mois en heure de Toronto, pas UTC", () => {
    // 1er juillet 02:00 UTC = 30 juin 22:00 à Toronto → mois précédent.
    expect(inMonth("2026-07-01T02:00:00Z")).toBe(false);
    // Début du mois de Toronto = 1er juillet 04:00 UTC (EDT).
    expect(inMonth("2026-07-01T04:00:00Z")).toBe(true);
  });
});

describe("monthlyCadence", () => {
  it("partitionne publiés / planifiés / brouillons du mois", () => {
    const cadence = monthlyCadence(
      [
        post("published", { published_at: "2026-07-05T14:00:00Z" }),
        post("published", { published_at: "2026-06-05T14:00:00Z" }), // hors mois
        post("scheduled", { scheduled_for: "2026-07-20T14:00:00Z" }),
        post("approved", { scheduled_for: "2026-07-22T14:00:00Z" }),
        post("draft", { scheduled_for: "2026-07-25T14:00:00Z" }),
        post("failed", { scheduled_for: "2026-07-25T14:00:00Z" }), // ni l'un ni l'autre
      ],
      4,
      NOW,
    );

    expect(cadence.published).toBe(1);
    expect(cadence.scheduled).toBe(2);
    expect(cadence.drafts).toBe(1);
    expect(cadence.remaining).toBe(1); // 4 − 1 − 2
    expect(cadence.late).toBe(false); // on est le 15
  });

  it("restants ne descend jamais sous zéro", () => {
    const cadence = monthlyCadence(
      [
        post("published", { published_at: "2026-07-05T14:00:00Z" }),
        post("published", { published_at: "2026-07-08T14:00:00Z" }),
      ],
      1,
      NOW,
    );
    expect(cadence.remaining).toBe(0);
  });

  it("en retard passé le 20 avec restants", () => {
    const late = monthlyCadence([], 2, new Date("2026-07-25T12:00:00Z"));
    expect(late.remaining).toBe(2);
    expect(late.late).toBe(true);
  });
});
