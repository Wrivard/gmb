import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { HISTORY_PAGE, loadInboxReviews } from "@/lib/reviews/inbox";
import { getClientsIndex } from "@/lib/queries/agency";
import { DemoBanner } from "@/components/layout/demo-banner";
import { OpsTabs } from "@/components/layout/ops-tabs";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { ReviewsInbox } from "./reviews-inbox";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ hist?: string }>;
}) {
  // Un seul rendu : loadInboxReviews sert les fixtures démo quand
  // Supabase n'est pas configuré (adapter démo derrière la même interface).
  const demo = !supabaseConfigured();
  const { hist } = await searchParams;
  // « Afficher plus d'historique » recharge avec une borne élargie.
  const historyLimit = Math.min(
    Math.max(Number(hist) || HISTORY_PAGE, HISTORY_PAGE),
    1500,
  );
  let agencyId = "";
  let hasProjects = true;
  let myClientIds: string[] = [];
  if (!demo) {
    const { member } = await getSessionContext();
    if (!member) return null; // Le layout gère la whitelist.
    agencyId = member.agency_id;
    // Déjà en cache (layout) : distingue « rien à faire » de « rien de
    // connecté » pour ne pas fêter un vide qui est en fait un first-run.
    const { data: clients } = await getClientsIndex(agencyId);
    hasProjects = Boolean(clients?.length);
    myClientIds = (clients ?? [])
      .filter((c) => c.assignee_member_id === member.id)
      .map((c) => c.id);
  }

  const inboxReviews = await loadInboxReviews({ agencyId }, { historyLimit });

  return (
    <div className="flex flex-col gap-5">
      {demo ? <DemoBanner /> : <RealtimeRefresh />}
      <OpsTabs />
      <p className="text-sm text-muted-foreground">
        Lis le brouillon, ajuste au besoin, publie. 10 secondes par review.
      </p>
      <ReviewsInbox
        reviews={inboxReviews}
        hasProjects={hasProjects}
        myClientIds={myClientIds}
        historyLimit={historyLimit}
      />
    </div>
  );
}
