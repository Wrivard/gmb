import { describe, expect, it } from "vitest";
import { locationToProfile, mergeProfile, periodsToHours } from "./profile-import";
import type { GbpLocation } from "./types";

// Les formes viennent du payload réel de la fiche Küa (2026-09-24).
const KUA: GbpLocation = {
  name: "locations/969929714678485332",
  title: "Küa",
  phoneNumbers: { primaryPhone: "(438) 544-1234" },
  websiteUri: "https://www.kua.quebec/",
  categories: {
    primaryCategory: { displayName: "Marketing agency" },
    additionalCategories: [{ displayName: "Website designer" }],
  },
  profile: { description: "Küa est une agence spécialisée en création." },
  regularHours: {
    periods: [
      { openDay: "MONDAY", openTime: { hours: 9 }, closeDay: "MONDAY", closeTime: { hours: 17 } },
      { openDay: "FRIDAY", openTime: { hours: 9, minutes: 30 }, closeDay: "FRIDAY", closeTime: { hours: 17 } },
    ],
  },
  openInfo: { openingDate: { year: 2024, month: 3 } },
};

describe("periodsToHours", () => {
  it("convertit les jours ouverts et ferme explicitement les autres", () => {
    const hours = periodsToHours(KUA.regularHours?.periods);
    expect(hours?.monday).toEqual({ open: "09:00", close: "17:00" });
    expect(hours?.friday).toEqual({ open: "09:30", close: "17:00" });
    // Fermé n'est pas la même chose qu'inconnu : le wizard doit voir un
    // horaire complet, pas un trou à remplir.
    expect(hours?.sunday).toBeNull();
    expect(hours?.tuesday).toBeNull();
  });

  it("fusionne deux tranches d'un même jour en gardant la plus large", () => {
    const hours = periodsToHours([
      { openDay: "MONDAY", openTime: { hours: 9 }, closeDay: "MONDAY", closeTime: { hours: 12 } },
      { openDay: "MONDAY", openTime: { hours: 13 }, closeDay: "MONDAY", closeTime: { hours: 18 } },
    ]);
    expect(hours?.monday).toEqual({ open: "09:00", close: "18:00" });
  });

  it("une heure absente vaut minuit", () => {
    const hours = periodsToHours([
      { openDay: "SATURDAY", openTime: {}, closeDay: "SATURDAY", closeTime: { hours: 23, minutes: 59 } },
    ]);
    expect(hours?.saturday).toEqual({ open: "00:00", close: "23:59" });
  });

  it("sans période, on ne prétend pas connaître les horaires", () => {
    expect(periodsToHours(undefined)).toBeUndefined();
    expect(periodsToHours([])).toBeUndefined();
  });
});

describe("locationToProfile", () => {
  it("remonte ce que la fiche porte déjà", () => {
    const profile = locationToProfile(KUA);
    expect(profile.categories).toEqual({
      primary: "Marketing agency",
      additional: ["Website designer"],
    });
    expect(profile.identity?.phone).toBe("(438) 544-1234");
    expect(profile.identity?.website).toBe("https://www.kua.quebec/");
    expect(profile.description).toContain("agence spécialisée");
    expect(profile.opening_date).toBe("2024-03");
    expect(profile.hours?.monday).toEqual({ open: "09:00", close: "17:00" });
  });

  // Le score doit rester honnête : un champ absent chez Google reste
  // absent ici, pour que le wizard continue de le réclamer.
  it("n'invente rien pour une fiche vide", () => {
    const profile = locationToProfile({
      name: "locations/1",
      title: "Vide",
    });
    expect(profile.description).toBeUndefined();
    expect(profile.hours).toBeUndefined();
    expect(profile.services).toBeUndefined();
    expect(profile.categories).toBeUndefined();
    expect(profile.identity).toEqual({ name: "Vide" });
  });

  it("lit les services libres comme les services structurés", () => {
    const profile = locationToProfile({
      name: "locations/1",
      title: "X",
      serviceItems: [
        { freeFormServiceItem: { label: { displayName: "Toiture", description: "Pose" } } },
        { structuredServiceItem: { serviceTypeId: "job_type_id:bathroom_remodeling" } },
      ],
    });
    expect(profile.services).toEqual([
      { name: "Toiture", description: "Pose" },
      { name: "bathroom remodeling", description: undefined },
    ]);
  });
});

describe("mergeProfile", () => {
  // Un rafraîchissement ne doit jamais effacer une description
  // retravaillée dans l'app mais pas encore poussée chez Google.
  it("la saisie de l'équipe gagne sur Google", () => {
    const merged = mergeProfile(
      { description: "Texte retravaillé par l'équipe" },
      locationToProfile(KUA),
    );
    expect(merged.description).toBe("Texte retravaillé par l'équipe");
    expect(merged.hours?.monday).toEqual({ open: "09:00", close: "17:00" });
  });

  it("Google comble les trous", () => {
    const merged = mergeProfile({}, locationToProfile(KUA));
    expect(merged.description).toContain("agence spécialisée");
    expect(merged.categories?.primary).toBe("Marketing agency");
  });

  it("fusionne l'identité champ par champ", () => {
    const merged = mergeProfile(
      { identity: { phone: "(514) 000-0000" } },
      locationToProfile(KUA),
    );
    expect(merged.identity?.phone).toBe("(514) 000-0000");
    expect(merged.identity?.website).toBe("https://www.kua.quebec/");
  });

  it("une liste de services vide n'écrase pas celle de Google", () => {
    const fromGoogle = { services: [{ name: "Toiture" }] };
    expect(mergeProfile({ services: [] }, fromGoogle).services).toEqual([
      { name: "Toiture" },
    ]);
  });
});
