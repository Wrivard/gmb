import { describe, expect, it } from "vitest";
import {
  isLate,
  remainingPosts,
  suggestPostDates,
  torontoInstant,
  torontoMonthRange,
  torontoParts,
} from "./due";

describe("torontoInstant", () => {
  it("convertit une heure murale d'été (EDT, UTC-4)", () => {
    expect(torontoInstant(2026, 7, 15, 10, 0).toISOString()).toBe(
      "2026-07-15T14:00:00.000Z",
    );
  });

  it("convertit une heure murale d'hiver (EST, UTC-5)", () => {
    expect(torontoInstant(2026, 1, 15, 10, 0).toISOString()).toBe(
      "2026-01-15T15:00:00.000Z",
    );
  });
});

describe("torontoMonthRange", () => {
  it("borne le mois de Toronto, pas le mois UTC", () => {
    // 1er juillet 02:00 UTC = 30 juin 22:00 à Toronto → mois de juin.
    const range = torontoMonthRange(new Date("2026-07-01T02:00:00Z"));
    expect(torontoParts(range.start)).toMatchObject({
      year: 2026,
      month: 6,
      day: 1,
    });
    expect(torontoParts(range.end)).toMatchObject({
      year: 2026,
      month: 7,
      day: 1,
    });
  });
});

describe("remainingPosts", () => {
  it("cadence − publiés − planifiés, plancher à 0", () => {
    expect(
      remainingPosts({
        postsPerMonth: 2,
        publishedThisMonth: 1,
        scheduledThisMonth: 0,
      }),
    ).toBe(1);
    expect(
      remainingPosts({
        postsPerMonth: 2,
        publishedThisMonth: 1,
        scheduledThisMonth: 2,
      }),
    ).toBe(0);
  });
});

describe("isLate", () => {
  const midMonth = new Date("2026-07-10T14:00:00Z");
  const late = new Date("2026-07-22T14:00:00Z");

  it("en retard seulement passé le 20 avec des restants", () => {
    expect(isLate(midMonth, 1)).toBe(false);
    expect(isLate(late, 1)).toBe(true);
    expect(isLate(late, 0)).toBe(false);
  });
});

describe("suggestPostDates", () => {
  it("répartit uniformément sur le reste du mois, 10 h Toronto", () => {
    const dates = suggestPostDates(new Date("2026-07-01T12:00:00Z"), 2);
    expect(dates).toHaveLength(2);
    for (const date of dates) {
      const parts = torontoParts(date);
      expect(parts.month).toBe(7);
      expect(parts.hour).toBe(10);
      expect(parts.day).toBeGreaterThanOrEqual(3);
    }
    expect(torontoParts(dates[1]).day).toBeGreaterThan(
      torontoParts(dates[0]).day,
    );
  });

  it("évite les week-ends", () => {
    const dates = suggestPostDates(new Date("2026-07-01T12:00:00Z"), 4);
    for (const date of dates) {
      const { year, month, day } = torontoParts(date);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      expect(weekday).toBeGreaterThanOrEqual(1);
      expect(weekday).toBeLessThanOrEqual(5);
    }
  });

  it("jamais deux posts le même jour", () => {
    const dates = suggestPostDates(new Date("2026-07-20T12:00:00Z"), 3);
    const days = dates.map((d) => torontoParts(d).day);
    expect(new Set(days).size).toBe(days.length);
  });

  it("fin de mois : les dates restent dans le mois", () => {
    const dates = suggestPostDates(new Date("2026-07-30T12:00:00Z"), 2);
    for (const date of dates) {
      expect(torontoParts(date).month).toBe(7);
    }
  });

  it("count 0 → aucune date", () => {
    expect(suggestPostDates(new Date(), 0)).toEqual([]);
  });
});
