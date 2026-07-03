import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { DemoBanner } from "@/components/layout/demo-banner";
import { demoInboxReviews } from "@/lib/demo";
import { ReviewsInbox, type InboxReview } from "./reviews-inbox";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-4">
        <DemoBanner />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Inbox Reviews
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lis le draft, ajuste au besoin, publie. 10 secondes par review.
          </p>
        </div>
        <ReviewsInbox reviews={demoInboxReviews()} />
      </div>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = await getDb();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("agency_id", member.agency_id);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .in("client_id", [...clientById.keys()])
    .order("review_created_at", { ascending: false });

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: replies } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("review_id, draft_text, published_text, generation_count")
        .in("review_id", reviewIds)
    : { data: [] };
  const replyByReview = new Map(
    (replies ?? []).map((reply) => [reply.review_id, reply]),
  );

  const inboxReviews: InboxReview[] = (reviews ?? []).map((review) => {
    const reply = replyByReview.get(review.id);
    return {
      id: review.id,
      clientId: review.client_id,
      clientName: clientById.get(review.client_id) ?? "(client inconnu)",
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inbox Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lis le draft, ajuste au besoin, publie. 10 secondes par review.
        </p>
      </div>
      <ReviewsInbox reviews={inboxReviews} />
    </div>
  );
}
