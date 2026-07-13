import "server-only";

import { Jimp, JimpMime } from "jimp";
import { getDb } from "@/lib/supabase/db";
import { generatePostContent } from "@/lib/ai/posts";
import { generatePostImage } from "@/lib/ai/images";
import { logActivity } from "@/lib/activity";
import { suggestPostDates } from "@/lib/due";
import { monthlyCadence } from "@/lib/posts/cadence";
import type { Client } from "@/lib/types/database";

// Pipeline de génération d'un post (specs/06 §Workflow) :
// contenu AI → image AI (OpenAI, repli Gemini) → jimp 1200×900 JPEG 85 →
// Storage → ligne `posts` en draft (ou scheduled si auto_publish_posts).
// jimp (pur JS) et non sharp : le binaire natif de sharp ne survivait pas
// au tracing Vercel (pnpm + Turbopack) — KUA-LOCALE-7.

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
  const image = await Jimp.read(raw);
  image.cover({ w: 1200, h: 900 });
  const jpeg = await image.getBuffer(JimpMime.jpeg, { quality: 85 });

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
  /** Prompt d'image du post — pour lancer attachPostImage en différé. */
  imagePrompt: string;
}

/** Génère et attache l'image d'un post déjà inséré (idempotent, différable). */
export async function attachPostImage(
  clientId: string,
  postId: string,
  imagePrompt: string,
): Promise<boolean> {
  const raw = await generatePostImage(imagePrompt);
  if (!raw) return false;
  const path = await processAndUploadImage(raw, clientId, postId);
  if (!path) return false;

  const supabase = await getDb();
  const { error } = await supabase
    .from("posts")
    .update({ image_path: path })
    .eq("id", postId);
  if (error) {
    console.error("Attache image post:", error.message);
    return false;
  }
  return true;
}

/** Génère UN post pour un client (contenu + image + insert draft). */
export async function generatePostForClient(
  client: Client,
  actor: string,
  now: Date = new Date(),
  directive?: string,
  /** Date de publication voulue — sinon la prochaine suggestion de cadence. */
  scheduledForOverride?: Date,
  /** true = ne pas générer l'image ici : l'appelant la lancera en différé
      (after) pour rendre la main dès que le texte est prêt. */
  deferImage = false,
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
  let hasImage = false;
  if (!deferImage) {
    hasImage = await attachPostImage(client.id, postId, content.imagePrompt);
  }

  await logActivity({
    agencyId: client.agency_id,
    clientId: client.id,
    actor,
    action: "post_generated",
    payload: {
      post_id: postId,
      angle: content.angle,
      has_image: hasImage,
      by_ai: content.generatedByAi,
    },
  });

  return { postId, hasImage, imagePrompt: content.imagePrompt };
}
