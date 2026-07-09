import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { loadInboxReviews } from "@/lib/reviews/inbox";
import { DemoBanner } from "@/components/layout/demo-banner";
import { OpsTabs } from "@/components/layout/ops-tabs";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { ReviewsInbox } from "./reviews-inbox";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  // Un seul rendu : loadInboxReviews sert les fixtures démo quand
  // Supabase n'est pas configuré (adapter démo derrière la même interface).
  const demo = !supabaseConfigured();
  let agencyId = "";
  if (!demo) {
    const { member } = await getSessionContext();
    if (!member) return null; // Le layout gère la whitelist.
    agencyId = member.agency_id;
  }

  const inboxReviews = await loadInboxReviews({ agencyId });

  return (
    <div className="flex flex-col gap-5">
      {demo ? <DemoBanner /> : <RealtimeRefresh />}
      <OpsTabs />
      <p className="text-sm text-muted-foreground">
        Lis le draft, ajuste au besoin, publie. 10 secondes par review.
      </p>
      <ReviewsInbox reviews={inboxReviews} />
    </div>
  );
}
