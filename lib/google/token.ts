import "server-only";

import { getDb } from "@/lib/supabase/db";
import { decrypt } from "@/lib/crypto";

// Gestion du access token Google (specs/02 §B).
// La connexion est relue à chaque appel (la RLS scope la requête à
// l'agence de l'appelant — une connexion par agence, contrainte unique);
// seul le refresh OAuth est mis en cache, par connexion, jusqu'à
// expiry - 60 s. Un cache global partagé servirait le token d'une
// agence à une autre dans le même process.

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

const cacheByConnection = new Map<string, CachedToken>();

export function clearTokenCache(): void {
  cacheByConnection.clear();
}

export async function getAccessToken(): Promise<string> {
  const supabase = await getDb();
  const { data: connection } = await supabase
    .from("google_connections")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  if (!connection) throw new GoogleNotConnectedError();

  const cached = cacheByConnection.get(connection.id);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.accessToken;
  }

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
      cacheByConnection.delete(connection.id);
      // Alerte hors app à la BASCULE seulement (l'update ci-dessus ne
      // matche que si le statut n'était pas déjà revoked au chargement) :
      // sans ça, une révocation un vendredi soir stalle tout le week-end.
      if (connection.status === "active") {
        const { appLink, sendNotification } = await import("@/lib/notify");
        await sendNotification({
          subject: "🔴 Connexion Google révoquée — action requise",
          text: `Le refresh token Google a été révoqué : syncs et publications sont suspendus jusqu'à la reconnexion.\n\nReconnecter : ${appLink("/settings")}`,
        });
      }
      throw new GoogleConnectionRevokedError();
    }
    throw new Error(`Échec du refresh token Google (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cacheByConnection.set(connection.id, {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });

  await supabase
    .from("google_connections")
    .update({ last_refreshed_at: new Date().toISOString() })
    .eq("id", connection.id);

  return json.access_token;
}
