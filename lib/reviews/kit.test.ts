import { describe, expect, it } from "vitest";
import {
  defaultReviewMessage,
  isIos,
  renderReviewMessage,
  smsHref,
} from "./kit";

const kit = {
  review_link: "https://g.page/r/Xyz/review",
  message: "Bonjour {prenom}! Un avis pour {entreprise}? {lien} Merci!",
};

describe("renderReviewMessage", () => {
  it("remplace prénom, entreprise et lien", () => {
    const message = renderReviewMessage(kit, {
      businessName: "Toitures Bergeron",
      firstName: "Mme Bouchard",
    });
    expect(message).toBe(
      "Bonjour Mme Bouchard! Un avis pour Toitures Bergeron? https://g.page/r/Xyz/review Merci!",
    );
  });

  it("sans prénom : le placeholder disparaît proprement", () => {
    const message = renderReviewMessage(kit, {
      businessName: "Toitures Bergeron",
    });
    expect(message).toContain("Bonjour! Un avis");
    expect(message).not.toContain("{prenom}");
  });

  it("gabarit vide → gabarit par défaut", () => {
    const message = renderReviewMessage(
      { review_link: "https://g.page/r/Xyz/review", message: "  " },
      { businessName: "Toitures Bergeron" },
    );
    expect(message).toContain("Toitures Bergeron");
    expect(message).toContain("https://g.page/r/Xyz/review");
    expect(defaultReviewMessage()).toContain("{lien}");
  });

  it("sans lien configuré : pas de placeholder qui traîne", () => {
    const message = renderReviewMessage(
      { message: "Avis: {lien}" },
      { businessName: "X" },
    );
    expect(message).toBe("Avis:");
  });
});

describe("isIos", () => {
  it("iPhone", () => {
    expect(
      isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    ).toBe(true);
  });

  it("iPadOS en mode desktop (UA Macintosh + tactile)", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(isIos(ua, 5)).toBe(true);
    expect(isIos(ua, 0)).toBe(false); // vrai Mac
  });

  it("Android", () => {
    expect(isIos("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
});

describe("smsHref", () => {
  const message = "Salut! Un avis? https://g.page/r/Xyz/review";

  it("iOS : séparateur &", () => {
    expect(smsHref(message, true).startsWith("sms:&body=")).toBe(true);
  });

  it("Android : séparateur ?", () => {
    expect(smsHref(message, false).startsWith("sms:?body=")).toBe(true);
  });

  it("le corps est encodé", () => {
    const href = smsHref(message, false);
    expect(href).toContain(encodeURIComponent("https://g.page/r/Xyz/review"));
    expect(href).not.toContain(" ");
  });
});
