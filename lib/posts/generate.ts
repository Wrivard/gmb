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

const IMAGE_BUCKET = "post-images";

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

  const path = `${clientId}/${postId}.jpg`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) {
    console.error("Upload image post:", error.message);
    return null;
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
  const suggestions = suggestPostDates(now, Math.max(cadence.remaining, 1));
  const scheduledFor =
    suggestions[Math.min(cadence.drafts, suggestions.length - 1)] ??
    suggestions[0];

  const content = await generatePostContent({
    client,
    recentSummaries: (recentPosts ?? []).map((p) =>
      p.angle ? `[angle : ${p.angle}] ${p.summary}` : p.summary,
    ),
    now,
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
