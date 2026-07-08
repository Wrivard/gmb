"use server";

import { revalidatePath } from "next/cache";
import {
  loadReviewForMember,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import { getGbpClient } from "@/lib/gbp/client";
import { generateReplyDraft } from "@/lib/ai/replies";
import { logActivity } from "@/lib/activity";

// Google accepte ~4096 caractères pour une réponse d'avis.
const MAX_REPLY_LENGTH = 4096;

export async function publishReplyAction(
  reviewId: string,
  text: string,
): Promise<ActionResult> {
  return runAction("La publication a échoué.", async () => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: "La réponse est vide." };
    if (trimmed.length > MAX_REPLY_LENGTH) {
      return {
        ok: false,
        error: `Réponse trop longue (max ${MAX_REPLY_LENGTH} caractères).`,
      };
    }

    const { member, supabase, review, client } =
      await loadReviewForMember(reviewId);

    await getGbpClient().putReviewReply(review.gbp_review_name, trimmed);

    const now = new Date().toISOString();
    const { error: replyError } = await supabase.from("review_replies").upsert(
      {
        review_id: review.id,
        draft_text: trimmed,
        published_text: trimmed,
        published_at: now,
        approved_by: member.id,
        publish_error: null,
      },
      { onConflict: "review_id" },
    );
    if (replyError) throw new Error(replyError.message);

    await supabase
      .from("reviews")
      .update({ status: "replied", was_updated: false })
      .eq("id", review.id);

    await logActivity({
      agencyId: member.agency_id,
      clientId: client.id,
      actor: member.email,
      action: "reply_published",
      payload: { review_id: review.id },
    });

    revalidatePath("/reviews");
    revalidatePath("/");
    return { ok: true };
  });
}

export async function regenerateReplyAction(
  reviewId: string,
  directive?: string,
): Promise<ActionResult & { draft?: string }> {
  return runAction("La régénération a échoué.", async () => {
    const { supabase, review, client } = await loadReviewForMember(reviewId);

    const { data: existingReply } = await supabase
      .from("review_replies")
      .select("draft_text, generation_count")
      .eq("review_id", review.id)
      .maybeSingle();

    const draft = await generateReplyDraft({
      client,
      review,
      directive,
      previousDraft: existingReply?.draft_text,
    });

    const { error: upsertError } = await supabase
      .from("review_replies")
      .upsert(
        {
          review_id: review.id,
          draft_text: draft.reply,
          generated_by_ai: draft.generatedByAi,
          generation_count: (existingReply?.generation_count ?? 0) + 1,
        },
        { onConflict: "review_id" },
      );
    if (upsertError) throw new Error(upsertError.message);

    if (review.status === "needs_reply") {
      await supabase
        .from("reviews")
        .update({ status: "draft_ready" })
        .eq("id", review.id);
    }

    revalidatePath("/reviews");
    return { ok: true, draft: draft.reply };
  });
}

/** Annule un « Ignorer » (toast undo) : redonne le statut d'attente. */
export async function unignoreReviewAction(
  reviewId: string,
): Promise<ActionResult> {
  return runAction("L'annulation a échoué.", async () => {
    const { supabase, review } = await loadReviewForMember(reviewId);
    if (review.status !== "ignored") return { ok: true };

    const { data: reply } = await supabase
      .from("review_replies")
      .select("draft_text")
      .eq("review_id", review.id)
      .maybeSingle();

    await supabase
      .from("reviews")
      .update({ status: reply?.draft_text ? "draft_ready" : "needs_reply" })
      .eq("id", review.id);

    revalidatePath("/reviews");
    revalidatePath("/");
    return { ok: true };
  });
}

export async function ignoreReviewAction(
  reviewId: string,
): Promise<ActionResult> {
  return runAction("L'action a échoué.", async () => {
    const { member, supabase, review, client } =
      await loadReviewForMember(reviewId);

    await supabase
      .from("reviews")
      .update({ status: "ignored" })
      .eq("id", review.id);

    await logActivity({
      agencyId: member.agency_id,
      clientId: client.id,
      actor: member.email,
      action: "review_ignored",
      payload: { review_id: review.id },
    });

    revalidatePath("/reviews");
    revalidatePath("/");
    return { ok: true };
  });
}
