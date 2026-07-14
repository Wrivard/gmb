import "server-only";

// Requêteur de l'inbox reviews — possède la requête, la jointure
// review_replies et le DTO InboxReview. Ce mapping était recopié
// verbatim entre reviews/page.tsx et l'onglet Reviews de la fiche client.
// Sans Supabase configuré : adapter démo (fixtures lib/demo.ts) derrière
// la même interface — le scope ne sert alors qu'au filtre clientId.

import { getDb } from "@/lib/supabase/db";
import { isDemoDataMode } from "@/lib/data-mode";
import { supabaseConfigured } from "@/lib/env";
import { demoInboxReviews } from "@/lib/demo";
import type { ReviewStatus } from "@/lib/types/database";

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

// La file « en attente » est le travail : jamais tronquée. L'historique
// (répondues/ignorées) est borné aux plus récentes — sans ça la requête
// et le DOM grossissent sans limite avec l'âge de l'agence.
const PENDING_STATUSES = ["needs_reply", "draft_ready", "approved"] as const;
export const HISTORY_PAGE = 150;

// Embeds PostgREST (forme vérifiée en runtime contre la base réelle) :
// clients = many-to-one → objet; review_replies = FK unique → objet|null.
// Une requête au lieu des trois hops clients → reviews → replies.
const INBOX_SELECT =
  "*, clients!inner(name, agency_id, status), review_replies(draft_text, published_text, generation_count)";

export async function loadInboxReviews(
  scope: InboxScope,
  options?: { historyLimit?: number },
): Promise<InboxReview[]> {
  if (!supabaseConfigured()) {
    const all = demoInboxReviews();
    return "clientId" in scope
      ? all.filter((review) => review.clientId === scope.clientId)
      : all;
  }

  const supabase = await getDb();
  const historyLimit = options?.historyLimit ?? HISTORY_PAGE;
  const demoData = await isDemoDataMode();

  const base = () => {
    const query = supabase
      .from("reviews")
      .select(INBOX_SELECT)
      .order("review_created_at", { ascending: false });
    return "agencyId" in scope
      ? query
          .eq("clients.agency_id", scope.agencyId)
          .eq("clients.is_demo", demoData)
          .neq("clients.status", "archived")
      : query.eq("client_id", scope.clientId);
  };

  // Pending (non borné) et historique (borné) en parallèle.
  const [{ data: pending, error: pendingError }, { data: history }] =
    await Promise.all([
      base().in("status", [...PENDING_STATUSES]),
      base().in("status", ["replied", "ignored"]).limit(historyLimit),
    ]);
  if (pendingError) throw new Error(pendingError.message);
  const rows = [...(pending ?? []), ...(history ?? [])];

  return rows.map((review) => ({
    id: review.id,
    clientId: review.client_id,
    clientName: review.clients.name,
    reviewerName: review.reviewer_name,
    starRating: review.star_rating,
    comment: review.comment,
    createdAt: review.review_created_at,
    status: review.status,
    wasUpdated: review.was_updated,
    draftText: review.review_replies?.draft_text ?? null,
    publishedText: review.review_replies?.published_text ?? null,
    generationCount: review.review_replies?.generation_count ?? 0,
  }));
}
