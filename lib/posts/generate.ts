import "server-only";

import sharp from "sharp";
import { getDb } from "@/lib/supabase/db";
import { generatePostContent } from "@/lib/ai/posts";
import { generatePostImage } from "@/lib/ai/images";
import { logActivity } from "@/lib/activity";
import { suggestPostDates } from "@/lib/due";
import { monthlyCadence } from "@/lib/posts/cadence";
import type { Client } from "@/lib/types/database";

// Pipeline de génération d'un post (specs/06 §Workflow) :
// contenu AI → image AI (OpenAI, repli Gemini) → sharp 1200×900 JPEG 85 →
// Storage → ligne `posts` en draft (ou scheduled si auto_publish_posts).

export const IMAGE_BUCKET = "post-images";

/** Horodatage extrait d'un nom versionné `<postId>-<ts>.jpg` (0 = legacy). */
export function imageVersionTime(name: string): number {
  const match = name.match(/-(\d+)\.jpg$/);
  return match ? Number(match[1]) : 0;
}

/** Toutes les versions d'image d'un post, la plus récente d'abord. */
export async function listImageVersions(
  supabase: Awaited<ReturnType<typeof getDb>>,
  clientId: string,
  postId: string,
): Promise<string[]> {
  const { data: files } = await supabase.storage
    .from(IMAGE_BUCKET)
    .list(clientId, { search: postId });
  return (files ?? [])
    .filter(
      (f) => f.name === `${postId}.jpg` || f.name.startsWith(`${postId}-`),
    )
    .sort((a, b) => imageVersionTime(b.name) - imageVersionTime(a.name))
    .map((f) => f.name);
}

export async function processAndUploadImage(
  raw: Buffer,
  clientId: string,
  postId: string,
): Promise<string | null> {
  const supabase = await getDb();
  const jpeg = await sharp(raw)
    .resize(1200, 900, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Clé versionnée : « générer une autre image » n'écrase plus la
  // précédente (revert possible), et l'URL change à chaque version —
  // fini le cache CDN qui sert l'ancienne image.
  const path = `${clientId}/${postId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) {
    console.error("Upload image post:", error.message);
    return null;
  }

  // Ménage : la version courante + une précédente suffisent.
  const versions = await listImageVersions(supabase, clientId, postId);
  const extra = versions.slice(2).map((name) => `${clientId}/${name}`);
  if (extra.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove(extra);
  }

  return path;
}

export interface GeneratedPost {
  postId: string;
  hasImage: boolean;
}

/** Génère UN post pour un client (contenu + image + insert draft). */
export async function generatePostForClient(
  client: Client,
  actor: string,
  now: Date = new Date(),
  directive?: string,
  /** Date de publication voulue — sinon la prochaine suggestion de cadence. */
  scheduledForOverride?: Date,
): Promise<GeneratedPost> {
  const supabase = await getDb();

  // Contexte du mois : cadence restante + posts récents pour la rotation.
  const [{ data: monthPosts }, { data: recentPosts }] = await Promise.all([
    supabase
      .from("posts")
      .select("status, scheduled_for, published_at")
      .eq("client_id", client.id),
    supabase
      .from("posts")
      .select("summary, angle")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const cadence = monthlyCadence(
    monthPosts ?? [],
    client.posts_per_month,
    now,
  );
  // Assez de dates pour les brouillons déjà créés + celui-ci : sans ça,
  // générer au-delà de la cadence assignait la même date à tous les drafts.
  const suggestions = suggestPostDates(
    now,
    Math.max(cadence.remaining, cadence.drafts + 1),
  );
  const scheduledFor =
    scheduledForOverride ??
    suggestions[Math.min(cadence.drafts, suggestions.length - 1)] ??
    suggestions[0];

  const content = await generatePostContent({
    client,
    recentSummaries: (recentPosts ?? []).map((p) =>
      p.angle ? `[angle : ${p.angle}] ${p.summary}` : p.summary,
    ),
    now,
    directive,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("posts")
    .insert({
      client_id: client.id,
      type: "STANDARD",
      summary: content.summary,
      cta_type: content.ctaType,
      cta_url: content.ctaType === "LEARN_MORE" ? client.website : null,
      image_prompt: content.imagePrompt,
      angle: content.angle || null,
      status: client.auto_publish_posts ? "scheduled" : "draft",
      scheduled_for: scheduledFor.toISOString(),
      generated_by_ai: content.generatedByAi,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  const postId = inserted.id;

  // Image : 2 tentatives dans generatePostImage; échec → draft sans image.
  let imagePath: string | null = null;
  const rawImage = await generatePostImage(content.imagePrompt);
  if (rawImage) {
    imagePath = await processAndUploadImage(rawImage, client.id, postId);
    if (imagePath) {
      await supabase
        .from("posts")
        .update({ image_path: imagePath })
        .eq("id", postId);
    }
  }

  await logActivity({
    agencyId: client.agency_id,
    clientId: client.id,
    actor,
    action: "post_generated",
    payload: {
      post_id: postId,
      angle: content.angle,
      has_image: Boolean(imagePath),
      by_ai: content.generatedByAi,
    },
  });

  return { postId, hasImage: Boolean(imagePath) };
}
