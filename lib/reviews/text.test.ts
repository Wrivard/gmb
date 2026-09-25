import { describe, expect, it } from "vitest";
import { originalComment } from "./text";

// Formes relevées dans les vrais avis de la fiche Küa (2026-09-24).
describe("originalComment", () => {
  it("garde l'original d'un avis traduit par Google", () => {
    expect(
      originalComment(
        "(Translated by Google) Great service! (Original) Excellent service!",
      ),
    ).toBe("Excellent service!");
  });

  it("conserve les sauts de ligne de l'original", () => {
    expect(
      originalComment(
        "(Translated by Google) Line one\nLine two (Original) Ligne un\nLigne deux",
      ),
    ).toBe("Ligne un\nLigne deux");
  });

  it("reconnaît la variante française de l'étiquette", () => {
    expect(
      originalComment("(Traduit par Google) Bonjour (Original) Hello"),
    ).toBe("Hello");
  });

  it("laisse intact un avis qui n'a pas été traduit", () => {
    expect(originalComment("Très bon service, merci !")).toBe(
      "Très bon service, merci !",
    );
  });

  // Un « (Original) » au milieu d'une phrase ordinaire ne doit pas
  // couper le texte : seul le préfixe de Google déclenche le découpage.
  it("ne coupe pas un avis qui mentionne « (Original) » sans préfixe", () => {
    const text = "Le modèle (Original) était meilleur que la copie.";
    expect(originalComment(text)).toBe(text);
  });

  it("rend null pour un avis vide", () => {
    expect(originalComment(null)).toBeNull();
    expect(originalComment("")).toBeNull();
    expect(originalComment("   ")).toBeNull();
  });
});
