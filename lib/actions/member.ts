import "server-only";

// Rituel commun des server actions : membre authentifié, chargement
// d'entités possédées par son agence, résultat {ok,error} normalisé.
// Le contrôle de propriété (filtre agency_id) vit ici, une seule fois —
// il était copié-collé dans chaque fichier d'actions.

import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function requireMember() {
  const { member } = await getSessionContext();
  if (!member) throw new Error("Non autorisé.");
  return member;
}

export async function getMemberDb() {
  const member = await requireMember();
  const supabase = await getDb();
  return { member, supabase };
}

/** Le seul endroit qui vérifie qu'un client appartient à l'agence du membre. */
async function ownedClient(
  supabase: Awaited<ReturnType<typeof getDb>>,
  agencyId: string,
  clientId: string,
  notFound: string,
) {
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!client) throw new Error(notFound);
  return client;
}

export async function loadClientForMember(clientId: string) {
  const { member, supabase } = await getMemberDb();
  const client = await ownedClient(
    supabase,
    member.agency_id,
    clientId,
    "Client introuvable.",
  );
  return { member, supabase, client };
}

export async function loadPostForMember(postId: string) {
  const { member, supabase } = await getMemberDb();
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (!post) throw new Error("Post introuvable.");
  const client = await ownedClient(
    supabase,
    member.agency_id,
    post.client_id,
    "Post introuvable.",
  );
  return { member, supabase, post, client };
}

export async function loadReviewForMember(reviewId: string) {
  const { member, supabase } = await getMemberDb();
  const { data: review } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) throw new Error("Review introuvable.");
  const client = await ownedClient(
    supabase,
    member.agency_id,
    review.client_id,
    "Review introuvable.",
  );
  return { member, supabase, review, client };
}

/** try/catch normalisé : toute exception devient `{ok:false, error}`. */
export async function runAction<T extends ActionResult>(
  fallbackError: string,
  fn: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : fallbackError,
    };
  }
}
