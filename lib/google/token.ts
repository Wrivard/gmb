import "server-only";

import { getDb } from "@/lib/supabase/db";
import { decrypt } from "@/lib/crypto";

// Gestion du access token Google (specs/02 §B).
// La connexion est relue à chaque appel; seul le refresh OAuth est mis
// en cache, par connexion, jusqu'à expiry - 60 s. Un cache global
// partagé servirait le token d'une agence à une autre dans le même
// process.
//
// Scope : mono-agence, VÉRIFIÉ et non supposé. Le commentaire d'origine
// affirmait que « la RLS scope la requête à l'agence de l'appelant » —
// faux dès que getDb() rend le client service-role (auth.uid() NULL,
// RLS contournée), ce qui est le cas normal en production. Tant que
// GbpClient ne transporte pas d'agence (refactor à faire quand l'accès
// GBP réel sera approuvé et validable), on refuse de deviner.

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
  const { data: connections } = await supabase
    .from("google_connections")
    .select("*")
    .eq("status", "active")
    .limit(2);

  if (!connections?.length) throw new GoogleNotConnectedError();
  if (connections.length > 1) {
    // Échec bruyant plutôt qu'un token servi à la mauvaise agence.
    throw new Error(
      "Plusieurs connexions Google actives : getAccessToken() ne peut pas " +
        "déterminer celle de l'appelant. Passer l'agence explicitement " +
        "avant d'ouvrir l'app à une seconde agence.",
    );
  }
  const connection = connections[0];

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
