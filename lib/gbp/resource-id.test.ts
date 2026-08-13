import { describe, expect, it } from "vitest";
import { gbpLocationPath, normalizeGbpResourceId } from "./resource-id";

describe("normalizeGbpResourceId", () => {
  it("laisse passer la forme canonique", () => {
    expect(normalizeGbpResourceId("accounts/108231694201573849275", "accounts")).toBe(
      "accounts/108231694201573849275",
    );
    expect(normalizeGbpResourceId("locations/7261849305718293645", "locations")).toBe(
      "locations/7261849305718293645",
    );
  });

  it("préfixe un identifiant recopié seul", () => {
    expect(normalizeGbpResourceId("7261849305718293645", "locations")).toBe(
      "locations/7261849305718293645",
    );
  });

  // Le piège : prendre le dernier nombre donnerait la fiche là où on
  // veut le compte — et publierait chez le mauvais commerce.
  it("découpe un nom de ressource complet selon le type demandé", () => {
    const full = "accounts/108231694201573849275/locations/7261849305718293645";
    expect(normalizeGbpResourceId(full, "accounts")).toBe(
      "accounts/108231694201573849275",
    );
    expect(normalizeGbpResourceId(full, "locations")).toBe(
      "locations/7261849305718293645",
    );
  });

  it("extrait l'identifiant d'une URL du tableau de bord Google", () => {
    expect(
      normalizeGbpResourceId(
        "https://business.google.com/dashboard/l/7261849305718293645",
        "locations",
      ),
    ).toBe("locations/7261849305718293645");
  });

  it("tolère les espaces autour", () => {
    expect(normalizeGbpResourceId("  locations/123456  ", "locations")).toBe(
      "locations/123456",
    );
  });

  it("refuse ce qui n'est pas exploitable", () => {
    expect(normalizeGbpResourceId("", "accounts")).toBeNull();
    expect(normalizeGbpResourceId("   ", "accounts")).toBeNull();
    expect(normalizeGbpResourceId("mon commerce", "locations")).toBeNull();
    // Trop court pour être un identifiant de fiche collé depuis une URL.
    expect(normalizeGbpResourceId("page 12", "locations")).toBeNull();
  });
});

describe("gbpLocationPath", () => {
  it("compose le nom attendu par l'API v4", () => {
    expect(
      gbpLocationPath("accounts/108231694201573849275", "locations/7261849305718293645"),
    ).toBe("accounts/108231694201573849275/locations/7261849305718293645");
  });
});
