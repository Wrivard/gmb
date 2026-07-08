import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { loadInboxReviews } from "@/lib/reviews/inbox";
import { DemoBanner } from "@/components/layout/demo-banner";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { demoInboxReviews } from "@/lib/demo";
import { ReviewsInbox } from "./reviews-inbox";

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

  const inboxReviews = await loadInboxReviews({ agencyId: member.agency_id });

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresh />
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
