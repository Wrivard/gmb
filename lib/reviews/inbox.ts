import "server-only";

// Requêteur de l'inbox reviews — possède la requête, la jointure
// review_replies et le DTO InboxReview. Ce mapping était recopié
// verbatim entre reviews/page.tsx et l'onglet Reviews de la fiche client.
// Sans Supabase configuré : adapter démo (fixtures lib/demo.ts) derrière
// la même interface — le scope ne sert alors qu'au filtre clientId.

import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { demoInboxReviews } from "@/lib/demo";
import type { Database, ReviewStatus } from "@/lib/types/database";

export interface InboxReview {
  id: string;
  clientId: string;
  clientName: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createdAt: string;
  status: ReviewStatus;
  wasUpdated: boolean;
  draftText: string | null;
  publishedText: string | null;
  generationCount: number;
}

export type InboxScope =
  | { agencyId: string }
  | { clientId: string; clientName: string };

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

// La file « en attente » est le travail : jamais tronquée. L'historique
// (répondues/ignorées) est borné aux plus récentes — sans ça la requête
// et le DOM grossissent sans limite avec l'âge de l'agence.
const PENDING_STATUSES = ["needs_reply", "draft_ready", "approved"] as const;
const HISTORY_LIMIT = 150;

export async function loadInboxReviews(
  scope: InboxScope,
): Promise<InboxReview[]> {
  if (!supabaseConfigured()) {
    const all = demoInboxReviews();
    return "clientId" in scope
      ? all.filter((review) => review.clientId === scope.clientId)
      : all;
  }

  const supabase = await getDb();

  let rows: ReviewRow[];
  let clientNameById: Map<string, string>;

  if ("agencyId" in scope) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .eq("agency_id", scope.agencyId);
    clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
    const clientIds = [...clientNameById.keys()];

    // Pending (non borné) et historique (borné) en parallèle.
    const [{ data: pending }, { data: history }] = await Promise.all([
      supabase
        .from("reviews")
        .select("*")
        .in("client_id", clientIds)
        .in("status", [...PENDING_STATUSES])
        .order("review_created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("*")
        .in("client_id", clientIds)
        .in("status", ["replied", "ignored"])
        .order("review_created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);
    rows = [...(pending ?? []), ...(history ?? [])];
  } else {
    clientNameById = new Map([[scope.clientId, scope.clientName]]);
    const [{ data: pending }, { data: history }] = await Promise.all([
      supabase
        .from("reviews")
        .select("*")
        .eq("client_id", scope.clientId)
        .in("status", [...PENDING_STATUSES])
        .order("review_created_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("*")
        .eq("client_id", scope.clientId)
        .in("status", ["replied", "ignored"])
        .order("review_created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);
    rows = [...(pending ?? []), ...(history ?? [])];
  }

  const reviewIds = rows.map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("review_id, draft_text, published_text, generation_count")
        .in("review_id", reviewIds)
    : { data: [] };
  const replyByReview = new Map(
    (replies ?? []).map((reply) => [reply.review_id, reply]),
  );

  return rows.map((review) => {
    const reply = replyByReview.get(review.id);
    return {
      id: review.id,
      clientId: review.client_id,
      clientName: clientNameById.get(review.client_id) ?? "(client inconnu)",
      reviewerName: review.reviewer_name,
      starRating: review.star_rating,
      comment: review.comment,
      createdAt: review.review_created_at,
      status: review.status,
      wasUpdated: review.was_updated,
      draftText: reply?.draft_text ?? null,
      publishedText: reply?.published_text ?? null,
      generationCount: reply?.generation_count ?? 0,
    };
  });
}
