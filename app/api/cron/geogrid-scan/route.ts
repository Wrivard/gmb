import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/supabase/db";
import { runGeogridScan, type ScanSummary } from "@/lib/geogrid/scan";
import { logActivity } from "@/lib/activity";

// Cron geogrid-scan — appelé chaque jour (GitHub Actions), scanne les
// clients DUS : actifs, mots-clés configurés, aucun scan ce mois-ci.
// Max 3 clients par passage (~100 requêtes API et ~30 s chacun) : la
// file se draine d'elle-même sur les premiers jours du mois.

export const maxDuration = 300;

const CLIENTS_PER_RUN = 3;

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const supabase = await getDb();

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "active");
  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const configured = (clients ?? []).filter(
    (c) => (c.geogrid?.keywords ?? []).some((k) => k.trim()),
  );
  if (!configured.length) {
    return NextResponse.json({ ok: true, scanned: 0, message: "aucun client configuré" });
  }

  // Déjà scannés ce mois-ci (peu importe le mot-clé) : pas dus.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: recent, error: recentError } = await supabase
    .from("geogrid_scans")
    .select("client_id")
    .gte("scanned_at", monthStart.toISOString());
  if (recentError) {
    return NextResponse.json({ error: recentError.message }, { status: 500 });
  }
  const scannedThisMonth = new Set((recent ?? []).map((r) => r.client_id));

  const due = configured
    .filter((c) => !scannedThisMonth.has(c.id))
    .slice(0, CLIENTS_PER_RUN);
  if (!due.length) {
    return NextResponse.json({ ok: true, scanned: 0, message: "tous à jour" });
  }

  const summaries: ScanSummary[] = [];
  let errors = 0;
  for (const client of due) {
    try {
      const summary = await runGeogridScan(supabase, client);
      summaries.push(summary);
      if (summary.scanned.length) {
        await logActivity({
          agencyId: client.agency_id,
          clientId: client.id,
          actor: "system",
          action: "geogrid_scanned",
          payload: {
            keywords: summary.scanned,
            cost_usd: Number(summary.costUsd.toFixed(4)),
          },
        });
      } else if (summary.skipped) {
        console.error(`geogrid ${client.name} sauté : ${summary.skipped}`);
      }
    } catch (error) {
      errors++;
      console.error(`geogrid scan (${client.name}):`, error);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: summaries.filter((s) => s.scanned.length).length,
    remaining: configured.length - scannedThisMonth.size - due.length,
    cost_usd: Number(
      summaries.reduce((acc, s) => acc + s.costUsd, 0).toFixed(4),
    ),
    errors,
  });
}
