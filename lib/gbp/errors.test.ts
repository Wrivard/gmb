import { describe, expect, it } from "vitest";
import {
  GbpAccessPendingError,
  GbpApiError,
  googleErrorDetail,
} from "./types";

// Un échec GBP ne remontait que « accounts.list → 403 » : le code sans
// la cause. Google met pourtant toujours l'explication dans le corps.

describe("googleErrorDetail", () => {
  it("extrait le message et le statut d'une erreur Google", () => {
    const body = JSON.stringify({
      error: {
        code: 403,
        message:
          "My Business Account Management API has not been used in project 908641351909 before or it is disabled.",
        status: "PERMISSION_DENIED",
      },
    });
    const detail = googleErrorDetail(body);
    expect(detail).toContain("PERMISSION_DENIED");
    expect(detail).toContain("has not been used in project");
  });

  it("garde un extrait quand le corps n'est pas du JSON", () => {
    expect(googleErrorDetail("Service Unavailable")).toContain(
      "Service Unavailable",
    );
  });

  // Vu en production : v4/accounts répond une page HTML de 404. En
  // recracher 300 caractères noyait le message sous du balisage.
  it("résume une page HTML au lieu de vomir le balisage", () => {
    const html =
      '<!DOCTYPE html>\n<html lang=en>\n<meta charset=utf-8>\n<title>Error 404 (Not Found)!!1</title>\n<style>*{margin:0;padding:0}</style>';
    const detail = googleErrorDetail(html);
    expect(detail).toContain("Error 404 (Not Found)");
    expect(detail).not.toContain("<style>");
    expect(detail).not.toContain("charset");
  });

  it("tronque un corps trop long", () => {
    expect(googleErrorDetail("x".repeat(1000)).length).toBeLessThan(320);
  });

  it("ne rend rien sans corps", () => {
    expect(googleErrorDetail(undefined)).toBe("");
    expect(googleErrorDetail("   ")).toBe("");
  });
});

describe("GbpApiError", () => {
  it("le message porte la cause, pas seulement le code", () => {
    const error = new GbpApiError(
      "accounts.list → 403",
      403,
      JSON.stringify({
        error: { message: "Request had insufficient authentication scopes.", status: "PERMISSION_DENIED" },
      }),
    );
    expect(error.message).toContain("accounts.list → 403");
    expect(error.message).toContain("insufficient authentication scopes");
    expect(error.status).toBe(403);
  });

  it("sans corps, le message reste inchangé", () => {
    expect(new GbpApiError("locations.list → 500", 500).message).toBe(
      "locations.list → 500",
    );
  });
});

// Cas réel du 2026-08-13 : l'approbation couvrait la v4 (600 req/min)
// mais pas Account Management. Le message générique envoyait chercher
// dans quatre consoles à la fois.
describe("GbpAccessPendingError", () => {
  it("nomme l'API en quota 0", () => {
    const error = new GbpAccessPendingError(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    );
    expect(error.message).toContain("mybusinessaccountmanagement.googleapis.com");
    expect(error.message).not.toContain("/v1/accounts");
  });

  it("garde le message générique sans endpoint", () => {
    expect(new GbpAccessPendingError().message).toContain(
      "en attente d'approbation",
    );
  });

  it("joint l'explication de Google si elle existe", () => {
    const error = new GbpAccessPendingError(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      JSON.stringify({
        error: { message: "Quota exceeded for quota metric 'Requests'.", status: "RESOURCE_EXHAUSTED" },
      }),
    );
    expect(error.message).toContain("RESOURCE_EXHAUSTED");
  });
});
