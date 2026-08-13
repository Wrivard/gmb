import { describe, expect, it } from "vitest";
import { GbpApiError, googleErrorDetail } from "./types";

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
    expect(googleErrorDetail("<html>Service Unavailable</html>")).toContain(
      "Service Unavailable",
    );
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
