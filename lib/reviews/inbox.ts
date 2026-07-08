import "server-only";

// Requêteur de l'inbox reviews — possède la requête, la jointure
// review_replies et le DTO InboxReview. Ce mapping était recopié
// verbatim entre reviews/page.tsx et l'onglet Reviews de la fiche client.

import { getDb } from "@/lib/supabase/db";
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

export async function loadInboxReviews(
  scope: InboxScope,
): Promise<InboxReview[]> {
  const supabase = await getDb();

  let rows: ReviewRow[];
  let clientNameById: Map<string, string>;

  if ("agencyId" in scope) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .eq("agency_id", scope.agencyId);
    clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .in("client_id", [...clientNameById.keys()])
      .order("review_created_at", { ascending: false });
    rows = reviews ?? [];
  } else {
    clientNameById = new Map([[scope.clientId, scope.clientName]]);
    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("client_id", scope.clientId)
      .order("review_created_at", { ascending: false });
    rows = reviews ?? [];
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
