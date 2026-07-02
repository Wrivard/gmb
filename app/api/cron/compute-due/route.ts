import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";
import { torontoParts } from "@/lib/due";

// Cron compute-due (specs/04) — 1x/jour.
// La vue client_board_state fait le gros du travail; ce cron log les
// compteurs du jour (base des notifications futures) et rafraîchit les
// snapshots de fiches 1x/semaine (dimanche) via la découverte.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: board } = await supabase
    .from("client_board_state")
    .select("agency_id, unreplied_count, posts_due")
    .eq("status", "active");

  const agencyId = board?.[0]?.agency_id ?? null;
  const totals = {
    clients: board?.length ?? 0,
    unreplied: (board ?? []).reduce((sum, row) => sum + row.unreplied_count, 0),
    postsDue: (board ?? []).reduce((sum, row) => sum + row.posts_due, 0),
  };

  await logActivity({
    agencyId,
    actor: "system",
    action: "due_computed",
    payload: totals,
  });

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
