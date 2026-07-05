import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/supabase/db";
import { getGbpClient } from "@/lib/gbp/client";
import { mapGbpReview, decideSync } from "@/lib/gbp/mapping";
import { GbpAccessPendingError } from "@/lib/gbp/types";
import { generateReplyDraft } from "@/lib/ai/replies";
import { logActivity } from "@/lib/activity";
import type { Client } from "@/lib/types/database";

// Cron sync-reviews (specs/04) — aux 30 min via Vercel Cron.
// batchGetReviews par compte → upsert par gbp_review_id → draft AI
// immédiat sur les nouvelles reviews → auto-publish si configuré (≥ 4★).

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
              await syncOneReview(supabase, gbp, client, gbpReview, counters);
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

  return NextResponse.json({ ok: true, ...counters });
}

type Supabase = Awaited<ReturnType<typeof getDb>>;
type Gbp = ReturnType<typeof getGbpClient>;

async function syncOneReview(
  supabase: Supabase,
  gbp: Gbp,
  client: Client,
  gbpReview: Parameters<typeof mapGbpReview>[0],
  counters: {
    imported: number;
    updated: number;
    drafts: number;
    autoPublished: number;
  },
): Promise<void> {
  const incoming = mapGbpReview(gbpReview);

  const { data: existing } = await supabase
    .from("reviews")
    .select("id, comment, star_rating, review_updated_at, status")
    .eq("gbp_review_id", incoming.gbp_review_id)
    .maybeSingle();

  const decision = decideSync(incoming, existing);
  if (decision.kind === "skip") return;

  let reviewId: string;
  if (decision.kind === "insert") {
    const { data: inserted, error } = await supabase
      .from("reviews")
      .insert({
        client_id: client.id,
        gbp_review_id: incoming.gbp_review_id,
        gbp_review_name: incoming.gbp_review_name,
        reviewer_name: incoming.reviewer_name,
        reviewer_photo_url: incoming.reviewer_photo_url,
        star_rating: incoming.star_rating,
        comment: incoming.comment,
        review_created_at: incoming.review_created_at,
        review_updated_at: incoming.review_updated_at,
        status: decision.status,
        synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    reviewId = inserted.id;
    counters.imported++;
  } else {
    if (!existing) return; // impossible par construction
    const { error } = await supabase
      .from("reviews")
      .update({
        reviewer_name: incoming.reviewer_name,
        reviewer_photo_url: incoming.reviewer_photo_url,
        star_rating: incoming.star_rating,
        comment: incoming.comment,
        review_updated_at: incoming.review_updated_at,
        status: decision.status,
        was_updated: decision.wasUpdated || undefined,
        synced_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    reviewId = existing.id;
    counters.updated++;
  }

  // Draft AI immédiat pour toute review qui attend une réponse.
  if (decision.status !== "needs_reply") return;

  const review = {
    id: reviewId,
    reviewer_name: incoming.reviewer_name,
    star_rating: incoming.star_rating,
    comment: incoming.comment,
  };

  const draft = await generateReplyDraft({ client, review });

  const { error: draftError } = await supabase.from("review_replies").upsert(
    {
      review_id: reviewId,
      draft_text: draft.reply,
      generated_by_ai: draft.generatedByAi,
    },
    { onConflict: "review_id" },
  );
  if (draftError) throw new Error(draftError.message);

  await supabase
    .from("reviews")
    .update({ status: "draft_ready" })
    .eq("id", reviewId);
  counters.drafts++;

  // Auto-publish : uniquement ≥ 4★; les négatives exigent un humain (specs/05).
  if (client.auto_publish_replies && incoming.star_rating >= 4) {
    try {
      await gbp.putReviewReply(incoming.gbp_review_name, draft.reply);
      const now = new Date().toISOString();
      await supabase
        .from("review_replies")
        .update({
          published_text: draft.reply,
          published_at: now,
          publish_error: null,
        })
        .eq("review_id", reviewId);
      await supabase
        .from("reviews")
        .update({ status: "replied" })
        .eq("id", reviewId);
      counters.autoPublished++;
      await logActivity({
        agencyId: client.agency_id,
        clientId: client.id,
        actor: "ai",
        action: "reply_auto_published",
        payload: { review_id: reviewId },
      });
    } catch (error) {
      // Draft prêt mais publication ratée : approved + erreur — le cron
      // publish (phase 5) sert de filet de retry.
      await supabase
        .from("review_replies")
        .update({
          publish_error:
            error instanceof Error ? error.message : "publication échouée",
        })
        .eq("review_id", reviewId);
      await supabase
        .from("reviews")
        .update({ status: "approved" })
        .eq("id", reviewId);
    }
  }
}
