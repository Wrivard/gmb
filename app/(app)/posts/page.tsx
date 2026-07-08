import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { loadAgencyQueue } from "@/lib/posts/queue";
import { DemoBanner } from "@/components/layout/demo-banner";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { demoQueueClients, demoQueuePosts } from "@/lib/demo";
import { PostsView } from "./posts-view";

export const metadata = { title: "Posts" };

export default async function PostsPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-4">
        <DemoBanner />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Posts GBP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Génère, révise, planifie — l&apos;app publie à la date prévue.
          </p>
        </div>
        <PostsView clients={demoQueueClients()} posts={demoQueuePosts()} />
      </div>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const { clients: queueClients, posts: queuePosts } = await loadAgencyQueue(
    member.agency_id,
  );

  return (
    <div className="flex flex-col gap-4">
      <RealtimeRefresh />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Posts GBP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Génère, révise, planifie — l&apos;app publie à la date prévue.
        </p>
      </div>
      <PostsView clients={queueClients} posts={queuePosts} />
    </div>
  );
}
