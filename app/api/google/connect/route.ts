import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionContext } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { getDb } from "@/lib/supabase/db";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";
import { env } from "@/lib/env";

// Démarre la connexion Google de l'agence (scope business.manage).
// En mode mock : pas de redirection vers Google — connexion factice
// immédiate + découverte des fixtures, pour une démo 100 % locale.
export async function GET() {
  const { member } = await getSessionContext();
  if (!member) {
    return NextResponse.redirect(new URL("/login", env.appUrl));
  }
  if (member.role !== "owner") {
    return NextResponse.redirect(
      new URL("/settings?error=owner_only", env.appUrl),
    );
  }

  if (env.gbpMode === "mock") {
    const supabase = await getDb();
    await supabase.from("google_connections").upsert(
      {
        agency_id: member.agency_id,
        google_email: "fiches@kua.quebec",
        refresh_token_encrypted: encrypt("mock-refresh-token"),
        status: "active",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "agency_id" },
    );
    await logActivity({
      agencyId: member.agency_id,
      actor: member.email,
      action: "google_connected",
      payload: { mode: "mock" },
    });
    await runDiscovery(member.agency_id, member.email);
    return NextResponse.redirect(new URL("/settings?connected=1", env.appUrl));
  }

  // Mode réel : OAuth avec state CSRF en cookie httpOnly.
  const state = randomBytes(24).toString("base64url");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  authUrl.searchParams.set(
    "redirect_uri",
    process.env.GOOGLE_REDIRECT_URI ?? `${env.appUrl}/api/google/callback`,
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/business.manage openid email",
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google",
  });
  return response;
}
