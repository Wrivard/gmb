"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGbpClient } from "@/lib/gbp/client";
import { generateReplyDraft } from "@/lib/ai/replies";
import { logActivity } from "@/lib/activity";

// Google accepte ~4096 caractères pour une réponse d'avis.
const MAX_REPLY_LENGTH = 4096;

type ActionResult = { ok: true } | { ok: false; error: string };

async function loadReviewForMember(reviewId: string) {
  const { member } = await getSessionContext();
  if (!member) throw new Error("Non autorisé.");

  const supabase = createAdminClient();
  const { data: review } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) throw new Error("Review introuvable.");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", review.client_id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (!client) throw new Error("Review introuvable.");

  return { member, supabase, review, client };
}

export async function publishReplyAction(
  reviewId: string,
  text: string,
): Promise<ActionResult> {
  try {
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
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La publication a échoué.",
    };
  }
}

export async function regenerateReplyAction(
  reviewId: string,
  directive?: string,
): Promise<ActionResult & { draft?: string }> {
  try {
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
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La régénération a échoué.",
    };
  }
}

/** Annule un « Ignorer » (toast undo) : redonne le statut d'attente. */
export async function unignoreReviewAction(
  reviewId: string,
): Promise<ActionResult> {
  try {
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "L'annulation a échoué.",
    };
  }
}

export async function ignoreReviewAction(
  reviewId: string,
): Promise<ActionResult> {
  try {
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "L'action a échoué.",
    };
  }
}
