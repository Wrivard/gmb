"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePostForClient, processAndUploadImage } from "@/lib/posts/generate";
import { publishPost } from "@/lib/posts/publish";
import { generatePostImage } from "@/lib/ai/images";
import { logActivity } from "@/lib/activity";
import type { CtaType } from "@/lib/types/database";

const MAX_SUMMARY_LENGTH = 1500;

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireMember() {
  const { member } = await getSessionContext();
  if (!member) throw new Error("Non autorisé.");
  return member;
}

async function loadPostForMember(postId: string) {
  const member = await requireMember();
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (!post) throw new Error("Post introuvable.");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", post.client_id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (!client) throw new Error("Post introuvable.");

  return { member, supabase, post, client };
}

function refresh() {
  revalidatePath("/posts");
  revalidatePath("/");
}

export async function generatePostAction(
  clientId: string,
): Promise<ActionResult & { postId?: string }> {
  try {
    const member = await requireMember();
    const supabase = createAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("agency_id", member.agency_id)
      .maybeSingle();
    if (!client) return { ok: false, error: "Client introuvable." };

    const result = await generatePostForClient(client, member.email);
    refresh();
    return { ok: true, postId: result.postId };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La génération a échoué.",
    };
  }
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
  try {
    const summary = input.summary.trim();
    if (!summary) return { ok: false, error: "Le texte du post est vide." };
    if (summary.length > MAX_SUMMARY_LENGTH) {
      return {
        ok: false,
        error: `Texte trop long (max ${MAX_SUMMARY_LENGTH} caractères).`,
      };
    }

    const { supabase, post } = await loadPostForMember(postId);
    if (post.status === "published" || post.status === "publishing") {
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
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "L'enregistrement a échoué.",
    };
  }
}

export async function approvePostAction(postId: string): Promise<ActionResult> {
  try {
    const { member, supabase, post, client } = await loadPostForMember(postId);
    if (post.status !== "draft" && post.status !== "failed") {
      return { ok: false, error: "Ce post n'est pas en brouillon." };
    }
    if (!post.scheduled_for) {
      return { ok: false, error: "Choisis d'abord une date de publication." };
    }

    const { error } = await supabase
      .from("posts")
      .update({
        status: "scheduled",
        approved_by: member.email,
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "L'approbation a échoué.",
    };
  }
}

export async function publishPostNowAction(
  postId: string,
): Promise<ActionResult> {
  try {
    const { member } = await loadPostForMember(postId);
    const result = await publishPost(
      postId,
      ["draft", "scheduled", "failed"],
      member.email,
    );
    refresh();
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La publication a échoué.",
    };
  }
}

export async function regeneratePostImageAction(
  postId: string,
  directive?: string,
): Promise<ActionResult> {
  try {
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
          "Génération d'image indisponible (GEMINI_API_KEY manquante ou échec).",
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
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La régénération a échoué.",
    };
  }
}

export async function uploadPostImageAction(
  postId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "L'upload a échoué.",
    };
  }
}
