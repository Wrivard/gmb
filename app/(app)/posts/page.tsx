import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { isLate, remainingPosts, torontoMonthRange } from "@/lib/due";
import { DemoBanner } from "@/components/layout/demo-banner";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { demoQueueClients, demoQueuePosts } from "@/lib/demo";
import { PostsView, type QueueClient, type QueuePost } from "./posts-view";

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

  const supabase = await getDb();
  const now = new Date();
  const range = torontoMonthRange(now);

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agency_id", member.agency_id)
    .eq("status", "active")
    .order("name");
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .in("client_id", [...clientById.keys()])
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const inMonth = (iso: string | null) =>
    Boolean(iso && new Date(iso) >= range.start && new Date(iso) < range.end);

  const queueClients: QueueClient[] = (clients ?? []).map((client) => {
    const clientPosts = (posts ?? []).filter((p) => p.client_id === client.id);
    const remaining = remainingPosts({
      postsPerMonth: client.posts_per_month,
      publishedThisMonth: clientPosts.filter(
        (p) => p.status === "published" && inMonth(p.published_at),
      ).length,
      scheduledThisMonth: clientPosts.filter(
        (p) =>
          (p.status === "scheduled" || p.status === "approved") &&
          inMonth(p.scheduled_for),
      ).length,
    });
    return {
      id: client.id,
      name: client.name,
      remaining,
      late: isLate(now, remaining),
    };
  });

  const queuePosts: QueuePost[] = (posts ?? [])
    .filter(
      (post) =>
        // Queue : tout ce qui est actif + les publiés du mois courant.
        post.status !== "published" || inMonth(post.published_at),
    )
    .map((post) => ({
      id: post.id,
      clientId: post.client_id,
      clientName: clientById.get(post.client_id)?.name ?? "(client inconnu)",
      summary: post.summary,
      status: post.status,
      scheduledFor: post.scheduled_for,
      publishedAt: post.published_at,
      publishError: post.publish_error,
      imageUrl: post.image_path
        ? supabase.storage.from("post-images").getPublicUrl(post.image_path)
            .data.publicUrl
        : null,
    }));

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
