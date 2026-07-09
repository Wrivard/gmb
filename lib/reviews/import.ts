import "server-only";

// Import d'UNE review GBP — possède toute la séquence d'effets :
// insert/update selon decideSync → draft AI immédiat → auto-publish
// ≥ 4★ avec repli `approved` si l'envoi rate (le cron publish-posts
// sert de filet de retry). L'auto-publish reste ici, dans le sync
// (décision #13). Extrait du cron sync-reviews pour être testable
// avec un faux Db/Gbp derrière la même interface.

import { decideSync, mapGbpReview } from "@/lib/gbp/mapping";
import { generateReplyDraft } from "@/lib/ai/replies";
import { logActivity } from "@/lib/activity";
import type { getDb } from "@/lib/supabase/db";
import type { getGbpClient } from "@/lib/gbp/client";
import type { Client } from "@/lib/types/database";

export interface ImportDeps {
  supabase: Awaited<ReturnType<typeof getDb>>;
  gbp: ReturnType<typeof getGbpClient>;
}

export interface ImportOutcome {
  imported: boolean;
  updated: boolean;
  draftCreated: boolean;
  autoPublished: boolean;
  /** Note de la review — permet au cron d'alerter sur les ≤ 2★ neuves. */
  starRating: number;
  reviewerName: string | null;
}

const NOTHING: Omit<ImportOutcome, "starRating" | "reviewerName"> = {
  imported: false,
  updated: false,
  draftCreated: false,
  autoPublished: false,
};

export async function importReview(
  client: Client,
  gbpReview: Parameters<typeof mapGbpReview>[0],
  { supabase, gbp }: ImportDeps,
): Promise<ImportOutcome> {
  const incoming = mapGbpReview(gbpReview);
  const outcome: ImportOutcome = {
    ...NOTHING,
    starRating: incoming.star_rating,
    reviewerName: incoming.reviewer_name,
  };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id, comment, star_rating, review_updated_at, status")
    .eq("gbp_review_id", incoming.gbp_review_id)
    .maybeSingle();

  const decision = decideSync(incoming, existing);
  if (decision.kind === "skip") return outcome;

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
    outcome.imported = true;
  } else {
    if (!existing) return outcome; // impossible par construction
    const { error } = await supabase
      .from("reviews")
      .update({
        reviewer_name: incoming.reviewer_name,
        reviewer_photo_url: incoming.reviewer_photo_url,
        star_rating: incoming.star_rating,
        comment: incoming.comment,
        review_updated_at: incoming.review_updated_at,
        status: decision.status,
        // Levé quand le texte change après notre réponse; nettoyé dès que
        // la review redevient `replied` (réponse publiée ici ou directement
        // sur Google); sinon `undefined` pour préserver un flag pas encore
        // traité par l'équipe.
        was_updated:
          decision.wasUpdated ||
          (decision.status === "replied" ? false : undefined),
        synced_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    reviewId = existing.id;
    outcome.updated = true;
  }

  // Draft AI immédiat pour toute review qui attend une réponse.
  if (decision.status !== "needs_reply") return outcome;

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
  outcome.draftCreated = true;

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
      outcome.autoPublished = true;
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

  return outcome;
}
