import { beforeEach, describe, expect, it } from "vitest";

// server-only est un no-op hors de Next — on le stub pour Vitest.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));

const { encrypt, decrypt } = await import("./crypto");

describe("crypto AES-256-GCM", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  it("round-trip encrypt/decrypt", () => {
    const secret = "1//refresh-token-très-secret";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produit un ciphertext différent à chaque appel (IV aléatoire)", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });

  it("rejette un payload altéré", () => {
    const payload = encrypt("secret");
    const raw = Buffer.from(payload, "base64");
    raw[raw.length - 1] ^= 0xff;
    expect(() => decrypt(raw.toString("base64"))).toThrow();
  });

  it("rejette un payload trop court", () => {
    expect(() => decrypt("AAAA")).toThrow(/invalide/);
  });

  it("tombe sur la clé dev en mode mock sans ENCRYPTION_KEY", () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.GBP_MODE = "mock";
    expect(decrypt(encrypt("token"))).toBe("token");
  });
});
