import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

// AES-256-GCM au niveau applicatif pour les refresh tokens Google
// (specs/01 §Sécurité). Format : base64(iv[12] | authTag[16] | ciphertext).

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  if ((process.env.GBP_MODE ?? "mock") === "mock") {
    // Mode mock sans clé : clé dérivée fixe, acceptable pour du dev
    // (le token « chiffré » est lui-même factice).
    return createHash("sha256").update("kua-locale-dev-mock-key").digest();
  }
  throw new Error(
    "ENCRYPTION_KEY manquante ou invalide (attendu : 32 bytes hex — `openssl rand -hex 32`).",
  );
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  if (raw.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Payload chiffré invalide.");
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
