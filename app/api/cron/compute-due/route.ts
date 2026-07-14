import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/supabase/db";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";
import { appLink, sendNotification } from "@/lib/notify";
import { torontoParts } from "@/lib/due";

// Cron compute-due (specs/04) — 1x/jour.
// La vue client_board_state fait le gros du travail; ce cron log les
// compteurs du jour, envoie le digest matinal (lib/notify) et rafraîchit
// les snapshots de fiches 1x/semaine (dimanche) via la découverte.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getDb();
  // Board COMPLET (fictifs inclus) : la comptabilité mensuelle et
  // l'ancrage d'agence en ont besoin. Seul le digest exclut les
  // fictifs — le filtre vit là-bas, pas ici.
  const { data: board } = await supabase
    .from("client_board_state")
    .select(
      "agency_id, client_id, name, unreplied_count, posts_due, worst_pending_rating, oldest_pending_review_at, failed_post_count, posts_per_month, posts_published_this_month, is_demo",
    )
    .eq("status", "active");

  // Couverture mensuelle persistée : posts_target figé au premier
  // passage du mois (ignoreDuplicates), posts_published rafraîchi chaque
  // jour. C'est la mémoire que le rollover du 1er effaçait.
  const { year, month } = torontoParts(new Date());
  const monthKey = `${year}-${String(month).padStart(2, "0")}-01`;
  for (const row of board ?? []) {
    if (row.posts_per_month <= 0) continue;
    await supabase.from("client_month_coverage").upsert(
      {
        client_id: row.client_id,
        month: monthKey,
        posts_target: row.posts_per_month,
        posts_published: row.posts_published_this_month,
      },
      { onConflict: "client_id,month", ignoreDuplicates: true },
    );
    await supabase
      .from("client_month_coverage")
      .update({
        posts_published: row.posts_published_this_month,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", row.client_id)
      .eq("month", monthKey);
  }

  const agencyId = board?.[0]?.agency_id ?? null;
  // Digest et compteurs du jour : les clients fictifs (mode démo) n'y
  // figurent jamais — pas de notification sur des dentistes imaginaires.
  const realBoard = (board ?? []).filter((row) => !row.is_demo);
  const totals = {
    clients: realBoard.length,
    unreplied: realBoard.reduce((sum, row) => sum + row.unreplied_count, 0),
    postsDue: realBoard.reduce((sum, row) => sum + row.posts_due, 0),
    failed: realBoard.reduce((sum, row) => sum + row.failed_post_count, 0),
  };

  await logActivity({
    agencyId,
    actor: "system",
    action: "due_computed",
    payload: totals,
  });

  // Digest matinal — seulement s'il y a quelque chose d'actionnable.
  const { data: connection } = agencyId
    ? await supabase
        .from("google_connections")
        .select("status")
        .eq("agency_id", agencyId)
        .maybeSingle()
    : { data: null };
  const revoked = connection?.status === "revoked";
  const pastDay20 = torontoParts(new Date()).day > 20;

  if (totals.unreplied || totals.failed || revoked || (pastDay20 && totals.postsDue)) {
    const lines: string[] = [];
    if (revoked) {
      lines.push(
        `🔴 Connexion Google révoquée — publications suspendues : ${appLink("/settings")}`,
      );
    }
    if (totals.failed) {
      lines.push(
        `🔴 ${totals.failed} publication${totals.failed > 1 ? "s" : ""} en échec à corriger`,
      );
    }
    if (totals.unreplied) {
      const urgent = realBoard.filter(
        (row) =>
          row.unreplied_count > 0 &&
          row.worst_pending_rating !== null &&
          row.worst_pending_rating <= 2,
      );
      lines.push(
        `${totals.unreplied} review${totals.unreplied > 1 ? "s" : ""} en attente${
          urgent.length
            ? ` — dont ≤2★ chez : ${urgent.map((row) => row.name).join(", ")}`
            : ""
        }`,
      );
    }
    if (pastDay20 && totals.postsDue) {
      lines.push(
        `⏰ ${totals.postsDue} post${totals.postsDue > 1 ? "s" : ""} du mois encore dus après le 20`,
      );
    }
    await sendNotification({
      subject: "Küa Locale — le point du matin",
      text: `${lines.join("\n")}\n\nTableau : ${appLink("/")}`,
    });
  }

  // Dimanche : rafraîchir les snapshots de fiches (adresse, catégorie…).
  let refreshed = false;
  const isSunday =
    new Date(
      Date.UTC(
        torontoParts(new Date()).year,
        torontoParts(new Date()).month - 1,
        torontoParts(new Date()).day,
      ),
    ).getUTCDay() === 0;
  if (isSunday && agencyId) {
    try {
      await runDiscovery(agencyId, "system");
      refreshed = true;
    } catch (error) {
      console.error("compute-due : découverte hebdomadaire échouée :", error);
    }
  }

  return NextResponse.json({ ok: true, ...totals, refreshed });
}
