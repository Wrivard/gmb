import "server-only";

import { getDb } from "@/lib/supabase/db";
import { decrypt } from "@/lib/crypto";

// Gestion du access token Google (specs/02 §B).
// Cache mémoire jusqu'à expiry - 60 s; refresh via le refresh token chiffré.

export class GoogleConnectionRevokedError extends Error {
  constructor() {
    super("Connexion Google révoquée — reconnexion requise dans Réglages.");
    this.name = "GoogleConnectionRevokedError";
  }
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Aucune connexion Google active — connecter le compte dans Réglages.");
    this.name = "GoogleNotConnectedError";
  }
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cache: CachedToken | null = null;

export function clearTokenCache(): void {
  cache = null;
}

export async function getAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt - 60_000) {
    return cache.accessToken;
  }

  const supabase = await getDb();
  const { data: connection } = await supabase
    .from("google_connections")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  if (!connection) throw new GoogleNotConnectedError();

  const refreshToken = decrypt(connection.refresh_token_encrypted);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (body.includes("invalid_grant")) {
      // Token révoqué : marquer la connexion et suspendre les publications.
      await supabase
        .from("google_connections")
        .update({ status: "revoked" })
        .eq("id", connection.id);
      cache = null;
      throw new GoogleConnectionRevokedError();
    }
    throw new Error(`Échec du refresh token Google (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  await supabase
    .from("google_connections")
    .update({ last_refreshed_at: new Date().toISOString() })
    .eq("id", connection.id);

  return json.access_token;
}
