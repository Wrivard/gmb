import { describe, expect, it } from "vitest";
import {
  configChecks,
  cronCheck,
  formatElapsed,
  worstStatus,
  type HealthEnv,
} from "./checks";

/** Configuration de production complète — le point de départ « tout va bien ». */
const HEALTHY: HealthEnv = {
  appUrl: "https://kua-locale.vercel.app",
  encryptionKey: "a".repeat(64),
  cronSecret: "s3cret",
  openaiKey: "sk-test",
  dataforseoLogin: "wrivard@kua.quebec",
  dataforseoPassword: "pw",
  gbpMode: "mock",
  publicGbpMode: "mock",
  notifyWebhook: "https://hooks.example/x",
};

function check(env: HealthEnv, key: string) {
  return configChecks(env).find((c) => c.key === key)!;
}

describe("configChecks", () => {
  it("une configuration complète ne lève rien de critique", () => {
    expect(configChecks(HEALTHY).some((c) => c.status === "critical")).toBe(false);
  });

  it("les manques bloquants sont critiques, pas de simples avertissements", () => {
    expect(check({ ...HEALTHY, encryptionKey: undefined }, "encryption").status).toBe("critical");
    expect(check({ ...HEALTHY, cronSecret: undefined }, "cron_secret").status).toBe("critical");
    expect(check({ ...HEALTHY, appUrl: undefined }, "app_url").status).toBe("critical");
  });

  it("une clé de chiffrement mal formée ne passe pas pour présente", () => {
    expect(check({ ...HEALTHY, encryptionKey: "trop-court" }, "encryption").status).toBe("critical");
  });

  it("localhost en production est signalé", () => {
    const result = check({ ...HEALTHY, appUrl: "http://localhost:3000" }, "app_url");
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("localhost");
  });

  it("les deux modes GBP désynchronisés sont signalés", () => {
    expect(check({ ...HEALTHY, gbpMode: "real", publicGbpMode: "mock" }, "gbp_mode").status).toBe("warn");
    expect(check({ ...HEALTHY, gbpMode: "real", publicGbpMode: "real" }, "gbp_mode").status).toBe("ok");
  });

  it("absents, les modes GBP valent « mock » et restent cohérents", () => {
    expect(check({}, "gbp_mode").status).toBe("ok");
  });

  it("Resend compte comme canal d'alerte seulement avec un destinataire", () => {
    const sansDestinataire = { ...HEALTHY, notifyWebhook: undefined, resendKey: "re_x" };
    expect(check(sansDestinataire, "notify").status).toBe("warn");
    expect(check({ ...sansDestinataire, notifyEmailTo: "wrivard@kua.quebec" }, "notify").status).toBe("ok");
  });

  it("la clé service_role est signalée comme contournant la sécurité de la base", () => {
    expect(check({ ...HEALTHY, serviceRoleKey: "srk" }, "service_role").status).toBe("warn");
    expect(check(HEALTHY, "service_role").status).toBe("ok");
  });

  it("n'expose jamais la valeur d'un secret", () => {
    const details = configChecks({ ...HEALTHY, serviceRoleKey: "super-secret-value" })
      .map((c) => c.detail)
      .join(" ");
    expect(details).not.toContain("super-secret-value");
    expect(details).not.toContain("s3cret");
    expect(details).not.toContain("sk-test");
  });
});

describe("cronCheck", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("jamais exécutée → piste concrète (le cas d'un secret absent)", () => {
    const result = cronCheck("sync", "Sync", null, 90 * 60_000, now);
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("CRON_SECRET");
  });

  it("exécution récente → ok", () => {
    const result = cronCheck("sync", "Sync", "2026-08-11T11:45:00Z", 90 * 60_000, now);
    expect(result.status).toBe("ok");
  });

  it("au-delà du seuil → avertissement", () => {
    const result = cronCheck("sync", "Sync", "2026-08-11T09:00:00Z", 90 * 60_000, now);
    expect(result.status).toBe("warn");
  });
});

describe("formatElapsed", () => {
  it("échelles lisibles", () => {
    expect(formatElapsed(30_000)).toBe("à l'instant");
    expect(formatElapsed(25 * 60_000)).toBe("il y a 25 min");
    expect(formatElapsed(3 * 3_600_000)).toBe("il y a 3 h");
    expect(formatElapsed(50 * 3_600_000)).toBe("il y a 2 j");
  });
});

describe("worstStatus", () => {
  it("le pire statut l'emporte", () => {
    expect(worstStatus([{ key: "a", label: "", status: "ok", detail: "" }])).toBe("ok");
    expect(
      worstStatus([
        { key: "a", label: "", status: "ok", detail: "" },
        { key: "b", label: "", status: "warn", detail: "" },
      ]),
    ).toBe("warn");
    expect(
      worstStatus([
        { key: "a", label: "", status: "warn", detail: "" },
        { key: "b", label: "", status: "critical", detail: "" },
      ]),
    ).toBe("critical");
  });
});
