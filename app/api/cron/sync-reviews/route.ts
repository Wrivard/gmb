import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/supabase/db";
import { getGbpClient } from "@/lib/gbp/client";
import { GbpAccessPendingError } from "@/lib/gbp/types";
import { importReview } from "@/lib/reviews/import";
import { logActivity } from "@/lib/activity";
import { appLink, sendNotification } from "@/lib/notify";
import type { Client } from "@/lib/types/database";

// Cron sync-reviews (specs/04) — aux 30 min via Vercel Cron.
// Auth + pagination batchGetReviews par compte; l'import d'une review
// (upsert → draft AI → auto-publish) vit dans lib/reviews/import.ts.

export const maxDuration = 300;

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const supabase = await getDb();
  const gbp = getGbpClient();

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "active");
  if (clientsError) {
    return NextResponse.json(
      { error: clientsError.message },
      { status: 500 },
    );
  }
  if (!clients?.length) {
    return NextResponse.json({ ok: true, synced: 0, message: "aucun client" });
  }

  // Clients groupés par compte; le batch v4 veut les resource names complets.
  const byAccount = new Map<string, Client[]>();
  for (const client of clients) {
    // Créé à la main, fiche pas encore liée : rien à synchroniser.
    if (!client.gbp_account_id || !client.gbp_location_id) continue;
    const list = byAccount.get(client.gbp_account_id) ?? [];
    list.push(client);
    byAccount.set(client.gbp_account_id, list);
  }

  const counters = {
    imported: 0,
    updated: 0,
    drafts: 0,
    autoPublished: 0,
    errors: 0,
  };
  // Reviews ≤ 2★ fraîchement importées : alerte immédiate à la fin du
  // run — c'est le cas où attendre le digest du matin coûte cher.
  const lowRatingAlerts: string[] = [];

  for (const [accountId, accountClients] of byAccount) {
    const clientByLocation = new Map<string, Client>(
      accountClients.map((c) => [`${accountId}/${c.gbp_location_id}`, c]),
    );

    try {
      let pageToken: string | undefined;
      do {
        const page = await gbp.batchGetReviews(
          accountId,
          [...clientByLocation.keys()],
          pageToken,
        );
        pageToken = page.nextPageToken;

        for (const bundle of page.locationReviews) {
          const client = clientByLocation.get(bundle.locationName);
          if (!client) continue;

          for (const gbpReview of bundle.reviews) {
            try {
              const outcome = await importReview(client, gbpReview, {
                supabase,
                gbp,
              });
              if (outcome.imported) counters.imported++;
              if (outcome.updated) counters.updated++;
              if (outcome.draftCreated) counters.drafts++;
              if (outcome.autoPublished) counters.autoPublished++;
              if (outcome.imported && outcome.starRating <= 2) {
                lowRatingAlerts.push(
                  `${outcome.starRating}★ chez ${client.name}${outcome.reviewerName ? ` (${outcome.reviewerName})` : ""}`,
                );
              }
            } catch (error) {
              counters.errors++;
              console.error(
                `sync review ${gbpReview.reviewId} (${client.name}):`,
                error,
              );
            }
          }
        }
      } while (pageToken);

      const now = new Date().toISOString();
      for (const client of accountClients) {
        await supabase
          .from("clients")
          .update({ last_synced_at: now })
          .eq("id", client.id);
      }
    } catch (error) {
      counters.errors++;
      if (error instanceof GbpAccessPendingError) {
        await logActivity({
          agencyId: accountClients[0].agency_id,
          actor: "system",
          action: "gbp_access_pending",
          payload: { account_id: accountId },
        });
      } else {
        console.error(`sync compte ${accountId}:`, error);
      }
    }
  }

  await logActivity({
    agencyId: clients[0].agency_id,
    actor: "system",
    action: "sync_completed",
    payload: counters,
  });

  if (lowRatingAlerts.length) {
    await sendNotification({
      subject: `⚠️ ${lowRatingAlerts.length} review${lowRatingAlerts.length > 1 ? "s" : ""} négative${lowRatingAlerts.length > 1 ? "s" : ""} à traiter`,
      text: `${lowRatingAlerts.join("\n")}\n\nRépondre : ${appLink("/reviews")}`,
    });
  }

  return NextResponse.json({ ok: true, ...counters });
}
