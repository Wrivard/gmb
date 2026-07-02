import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { getDb } from "@/lib/supabase/db";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";
import { clearTokenCache } from "@/lib/google/token";
import { env } from "@/lib/env";

// Callback OAuth Google (connexion GBP de l'agence — specs/02 §B).
export async function GET(request: NextRequest) {
  const { member } = await getSessionContext();
  if (!member) {
    return NextResponse.redirect(new URL("/login", env.appUrl));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      new URL("/settings?error=oauth_state", env.appUrl),
    );
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri:
        process.env.GOOGLE_REDIRECT_URI ?? `${env.appUrl}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    console.error("Échange OAuth Google:", await tokenResponse.text());
    return NextResponse.redirect(
      new URL("/settings?error=oauth_exchange", env.appUrl),
    );
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
  };

  if (!tokens.refresh_token) {
    // prompt=consent devrait toujours en émettre un; sinon l'utilisateur
    // doit révoquer l'accès dans son compte Google et réessayer.
    return NextResponse.redirect(
      new URL("/settings?error=no_refresh_token", env.appUrl),
    );
  }

  // Email du compte connecté depuis le id_token (scope openid email).
  let googleEmail = "compte Google";
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
      ) as { email?: string };
      googleEmail = payload.email ?? googleEmail;
    } catch {
      // non bloquant
    }
  }

  const supabase = await getDb();
  await supabase.from("google_connections").upsert(
    {
      agency_id: member.agency_id,
      google_email: googleEmail,
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      status: "active",
      connected_at: new Date().toISOString(),
    },
    { onConflict: "agency_id" },
  );
  clearTokenCache();

  await logActivity({
    agencyId: member.agency_id,
    actor: member.email,
    action: "google_connected",
    payload: { google_email: googleEmail },
  });

  // Découverte immédiate (plug-and-play).
  try {
    await runDiscovery(member.agency_id, member.email);
  } catch (error) {
    console.error("Découverte post-connexion:", error);
    // La connexion reste valide; la découverte est relançable depuis Réglages.
  }

  const response = NextResponse.redirect(
    new URL("/settings?connected=1", env.appUrl),
  );
  response.cookies.delete("google_oauth_state");
  return response;
}
