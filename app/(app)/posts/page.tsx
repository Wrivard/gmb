import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { loadAgencyQueue } from "@/lib/posts/queue";
import { DemoBanner } from "@/components/layout/demo-banner";
import { OpsTabs } from "@/components/layout/ops-tabs";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { PostsView } from "./posts-view";

export const metadata = { title: "Posts" };

export default async function PostsPage() {
  // Un seul rendu : loadAgencyQueue sert les fixtures démo quand
  // Supabase n'est pas configuré (adapter démo derrière la même interface).
  const demo = !supabaseConfigured();
  let agencyId = "";
  if (!demo) {
    const { member } = await getSessionContext();
    if (!member) return null; // Le layout gère la whitelist.
    agencyId = member.agency_id;
  }

  const { clients, posts } = await loadAgencyQueue(agencyId);

  return (
    <div className="flex flex-col gap-5">
      {demo ? <DemoBanner /> : <RealtimeRefresh />}
      <OpsTabs />
      <p className="text-sm text-muted-foreground">
        Génère, révise, planifie — l&apos;app publie à la date prévue.
      </p>
      <PostsView clients={clients} posts={posts} />
    </div>
  );
}
