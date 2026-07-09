"use server";

import { revalidatePath } from "next/cache";
import {
  loadClientForMember,
  loadPostForMember,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import {
  generatePostForClient,
  listImageVersions,
  processAndUploadImage,
} from "@/lib/posts/generate";
import { publishPost } from "@/lib/posts/publish";
import {
  isPostApprovable,
  isPostEditable,
  PUBLISHABLE_FROM,
} from "@/lib/posts/status";
import { generatePostImage } from "@/lib/ai/images";
import { logActivity } from "@/lib/activity";
import type { CtaType } from "@/lib/types/database";

const MAX_SUMMARY_LENGTH = 1500;

function refresh() {
  revalidatePath("/posts");
  revalidatePath("/");
}

export async function generatePostAction(
  clientId: string,
  directive?: string,
): Promise<ActionResult & { postId?: string }> {
  return runAction("La génération a échoué.", async () => {
    const { member, client } = await loadClientForMember(clientId);
    const result = await generatePostForClient(
      client,
      member.email,
      new Date(),
      directive?.trim() || undefined,
    );
    refresh();
    return { ok: true, postId: result.postId };
  });
}

export async function updatePostAction(
  postId: string,
  input: {
    summary: string;
    ctaType: CtaType | null;
    ctaUrl: string | null;
    scheduledFor: string | null;
  },
): Promise<ActionResult> {
  return runAction("L'enregistrement a échoué.", async () => {
    const summary = input.summary.trim();
    if (!summary) return { ok: false, error: "Le texte du post est vide." };
    if (summary.length > MAX_SUMMARY_LENGTH) {
      return {
        ok: false,
        error: `Texte trop long (max ${MAX_SUMMARY_LENGTH} caractères).`,
      };
    }

    const { supabase, post } = await loadPostForMember(postId);
    if (!isPostEditable(post.status)) {
      return { ok: false, error: "Ce post est déjà publié." };
    }

    const { error } = await supabase
      .from("posts")
      .update({
        summary,
        cta_type: input.ctaType,
        cta_url: input.ctaUrl?.trim() || null,
        scheduled_for: input.scheduledFor,
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);

    refresh();
    return { ok: true };
  });
}

export async function approvePostAction(postId: string): Promise<ActionResult> {
  return runAction("L'approbation a échoué.", async () => {
    const { member, supabase, post, client } = await loadPostForMember(postId);
    if (!isPostApprovable(post.status)) {
      return { ok: false, error: "Ce post n'est pas en brouillon." };
    }
    if (!post.scheduled_for) {
      return { ok: false, error: "Choisis d'abord une date de publication." };
    }

    const { error } = await supabase
      .from("posts")
      .update({
        status: "scheduled",
        approved_by: member.id,
        publish_error: null,
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);

    await logActivity({
      agencyId: member.agency_id,
      clientId: client.id,
      actor: member.email,
      action: "post_approved",
      payload: { post_id: postId },
    });

    refresh();
    return { ok: true };
  });
}

/**
 * Annule une approbation (toast undo) : scheduled → draft. Verrou
 * optimiste sur le statut — si le cron a déjà pris le post (publishing/
 * published), l'annulation est refusée proprement.
 */
export async function unapprovePostAction(
  postId: string,
): Promise<ActionResult> {
  return runAction("L'annulation a échoué.", async () => {
    const { member, supabase, post, client } = await loadPostForMember(postId);
    if (post.status !== "scheduled") {
      return {
        ok: false,
        error: "Trop tard — le post n'est plus planifié (déjà publié ?).",
      };
    }

    const { data: reverted, error } = await supabase
      .from("posts")
      .update({ status: "draft", approved_by: null })
      .eq("id", postId)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reverted) {
      return {
        ok: false,
        error: "Trop tard — le cron a déjà pris le post en charge.",
      };
    }

    await logActivity({
      agencyId: member.agency_id,
      clientId: client.id,
      actor: member.email,
      action: "post_unapproved",
      payload: { post_id: postId },
    });

    refresh();
    return { ok: true };
  });
}

export async function publishPostNowAction(
  postId: string,
): Promise<ActionResult> {
  return runAction("La publication a échoué.", async () => {
    const { member } = await loadPostForMember(postId);
    const result = await publishPost(
      postId,
      PUBLISHABLE_FROM.member,
      member.email,
    );
    refresh();
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  });
}

export async function regeneratePostImageAction(
  postId: string,
  directive?: string,
): Promise<ActionResult> {
  return runAction("La régénération a échoué.", async () => {
    const { supabase, post, client } = await loadPostForMember(postId);
    if (!post.image_prompt) {
      return { ok: false, error: "Ce post n'a pas de prompt d'image." };
    }

    const prompt = directive?.trim()
      ? `${post.image_prompt}. ${directive.trim()}`
      : post.image_prompt;
    const raw = await generatePostImage(prompt);
    if (!raw) {
      return {
        ok: false,
        error:
          "Génération d'image indisponible (clé OpenAI/Gemini manquante ou échec).",
      };
    }

    const path = await processAndUploadImage(raw, client.id, post.id);
    if (!path) return { ok: false, error: "L'upload de l'image a échoué." };

    const { error } = await supabase
      .from("posts")
      .update({ image_path: path })
      .eq("id", postId);
    if (error) throw new Error(error.message);

    refresh();
    return { ok: true };
  });
}

/** Restaure la version précédente de l'image (les clés sont versionnées). */
export async function revertPostImageAction(
  postId: string,
): Promise<ActionResult> {
  return runAction("Le retour à l'image précédente a échoué.", async () => {
    const { supabase, post, client } = await loadPostForMember(postId);
    if (!isPostEditable(post.status)) {
      return { ok: false, error: "Ce post est déjà publié." };
    }
    if (!post.image_path) {
      return { ok: false, error: "Ce post n'a pas d'image." };
    }

    const current = post.image_path.split("/").pop();
    const previous = (
      await listImageVersions(supabase, client.id, post.id)
    ).find((name) => name !== current);
    if (!previous) {
      return { ok: false, error: "Aucune image précédente à restaurer." };
    }

    const { error } = await supabase
      .from("posts")
      .update({ image_path: `${client.id}/${previous}` })
      .eq("id", postId);
    if (error) throw new Error(error.message);

    refresh();
    return { ok: true };
  });
}

export async function uploadPostImageAction(
  postId: string,
  formData: FormData,
): Promise<ActionResult> {
  return runAction("L'upload a échoué.", async () => {
    const file = formData.get("image");
    if (!(file instanceof File) || !file.size) {
      return { ok: false, error: "Aucune image fournie." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: "Image trop lourde (max 10 MB)." };
    }

    const { supabase, post, client } = await loadPostForMember(postId);
    const raw = Buffer.from(await file.arrayBuffer());
    const path = await processAndUploadImage(raw, client.id, post.id);
    if (!path) return { ok: false, error: "L'upload de l'image a échoué." };

    const { error } = await supabase
      .from("posts")
      .update({ image_path: path })
      .eq("id", postId);
    if (error) throw new Error(error.message);

    refresh();
    return { ok: true };
  });
}
