import "server-only";

import { getDb } from "@/lib/supabase/db";
import { getGbpClient } from "@/lib/gbp/client";
import { logActivity } from "@/lib/activity";
import { appLink, sendNotification } from "@/lib/notify";
import type { LocalPostInput } from "@/lib/gbp/types";
import type { PostStatus } from "@/lib/types/database";

// Un échec pendant le cron (personne devant l'écran) part en alerte —
// quand un humain publie, son toast suffit.
async function notifyCronFailure(
  actor: string,
  clientName: string,
  postId: string,
  error: string,
) {
  if (actor !== "system") return;
  await sendNotification({
    subject: `🔴 Publication échouée — ${clientName}`,
    text: `${error}\n\nCorriger : ${appLink(`/posts/${postId}`)}`,
  });
}

// Publication d'un post vers Google (partagé cron publish-posts +
// action « Publier maintenant »). Lock optimiste via le statut.

export type PublishResult =
  | { ok: true }
  | { ok: false; error: string; locked?: boolean };

export async function publishPost(
  postId: string,
  fromStatuses: PostStatus[],
  actor: string,
): Promise<PublishResult> {
  const supabase = await getDb();

  // Lock optimiste : ne prendre le post que s'il est dans un statut attendu.
  const { data: post } = await supabase
    .from("posts")
    .update({ status: "publishing" })
    .eq("id", postId)
    .in("status", fromStatuses)
    .select("*")
    .maybeSingle();
  if (!post) {
    return { ok: false, error: "Post déjà en cours de publication.", locked: true };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", post.client_id)
    .single();
  if (!client) {
    return { ok: false, error: "Client introuvable." };
  }
  // Projet créé à la main, fiche Google pas encore liée : impossible de
  // publier — remettre le post dans son statut plutôt que d'appeler
  // l'API avec un resource name « null/null ».
  if (!client.gbp_account_id || !client.gbp_location_id) {
    const error =
      "Aucune fiche Google liée à ce projet — connecte le compte Google d'abord.";
    await supabase
      .from("posts")
      .update({ status: "failed", publish_error: error })
      .eq("id", post.id);
    return { ok: false, error };
  }
  // Client fictif (démo) + API réelle : ses ids Google n'existent pas.
  if (client.is_demo && (process.env.GBP_MODE ?? "mock") === "real") {
    const error = "Client de démonstration — pas de publication réelle.";
    await supabase
      .from("posts")
      .update({ status: "failed", publish_error: error })
      .eq("id", post.id);
    return { ok: false, error };
  }

  try {
    const input: LocalPostInput = {
      languageCode: client.language,
      topicType: "STANDARD",
      summary: post.summary,
      ...(post.cta_type
        ? {
            callToAction: {
              actionType: post.cta_type,
              ...(post.cta_url ? { url: post.cta_url } : {}),
            },
          }
        : {}),
      ...(post.image_path
        ? {
            media: [
              {
                mediaFormat: "PHOTO" as const,
                sourceUrl: supabase.storage
                  .from("post-images")
                  .getPublicUrl(post.image_path).data.publicUrl,
              },
            ],
          }
        : {}),
    };

    const result = await getGbpClient().createLocalPost(
      `${client.gbp_account_id}/${client.gbp_location_id}`,
      input,
    );

    if (result.state === "REJECTED") {
      const error = "Rejeté par la modération Google.";
      await supabase
        .from("posts")
        .update({ status: "failed", publish_error: error })
        .eq("id", post.id);
      await notifyCronFailure(actor, client.name, post.id, error);
      return { ok: false, error };
    }

    await supabase
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        gbp_post_name: result.name,
        publish_error: null,
      })
      .eq("id", post.id);

    await logActivity({
      agencyId: client.agency_id,
      clientId: client.id,
      actor,
      action: "post_published",
      payload: { post_id: post.id },
    });
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "publication échouée";
    await supabase
      .from("posts")
      .update({ status: "failed", publish_error: message })
      .eq("id", post.id);
    await notifyCronFailure(actor, client.name, post.id, message);
    return { ok: false, error: message };
  }
}
