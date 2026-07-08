import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { frCA } from "date-fns/locale";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { isLate, remainingPosts } from "@/lib/due";
import { monthlyCadence } from "@/lib/posts/cadence";
import { DemoBanner } from "@/components/layout/demo-banner";
import {
  demoActivity,
  demoBoardClients,
  demoClientRows,
  demoInboxReviews,
  demoQueuePosts,
} from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ReviewsInbox,
  type InboxReview,
} from "@/app/(app)/reviews/reviews-inbox";
import {
  PostsView,
  type QueueClient,
  type QueuePost,
} from "@/app/(app)/posts/posts-view";
import { ClientSettings } from "./client-settings";

export const metadata = { title: "Fiche client" };

const TABS = [
  { key: "apercu", label: "Aperçu" },
  { key: "reviews", label: "Reviews" },
  { key: "posts", label: "Posts" },
  { key: "settings", label: "Réglages" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : "apercu";

  if (!supabaseConfigured()) {
    const board = demoBoardClients().find((c) => c.id === id);
    if (!board) notFound();
    const row = demoClientRows().find((c) => c.id === id);
    const reviews = demoInboxReviews().filter((r) => r.clientId === id);
    const posts = demoQueuePosts().filter((p) => p.clientId === id);

    const stats = [
      { label: "Reviews en attente", value: board.unreplied },
      { label: "Drafts de réponses", value: board.draftReplies },
      { label: "Posts dus ce mois", value: board.postsDue, alert: board.late },
      {
        label: "Posts publiés ce mois",
        value: posts.filter((p) => p.status === "published").length,
      },
      {
        label: "Note moyenne",
        value: board.avgRating !== null ? `${board.avgRating.toFixed(1)} ★` : "—",
      },
      { label: "Total d'avis", value: board.reviewCount },
    ];

    return (
      <div className="flex flex-col gap-4">
        <DemoBanner />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {board.name}
          </h1>
          <Badge variant={row?.status === "paused" ? "secondary" : "default"}>
            {row?.status === "paused" ? "En pause" : "Actif"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {[board.category, row?.address].filter(Boolean).join(" · ")}
          </span>
        </div>

        <nav className="flex gap-1 border-b border-border">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/clients/${id}?tab=${entry.key}`}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                tab === entry.key
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        {tab === "apercu" && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-elevated px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "text-lg font-semibold tabular-nums",
                      stat.alert && "text-destructive",
                    )}
                  >
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                Activité récente
              </h2>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-elevated px-4">
                {demoActivity().map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <span className="flex-1">
                      {entry.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        par {entry.actor}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.at), {
                        addSuffix: true,
                        locale: frCA,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
        {tab === "reviews" && <ReviewsInbox reviews={reviews} />}
        {tab === "posts" && (
          <PostsView
            clients={[
              {
                id: board.id,
                name: board.name,
                remaining: board.postsDue,
                late: board.late,
              },
            ]}
            posts={posts}
          />
        )}
        {tab === "settings" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Lecture seule en mode exemple — modifiable une fois Supabase
              branché.
            </p>
            <ClientSettings
              readOnly
              client={{
                id: board.id,
                posts_per_month: board.postsDue > 1 ? 2 : 1,
                language: "fr-CA",
                auto_publish_replies: true,
                auto_publish_posts: false,
                status: row?.status ?? "active",
                brand_profile: {
                  tone: "chaleureux et professionnel",
                  vertical: board.category ?? "",
                  city: board.city ?? "",
                  services_cles: ["service principal", "service secondaire"],
                  arguments: ["garantie 10 ans", "soumission gratuite"],
                  signature: `L'équipe ${board.name}`,
                  a_eviter: ["prix précis", "promesses de délai"],
                  phone: "450-555-0182",
                  notes:
                    "Entreprise familiale, 2e génération. Insister sur la fiabilité.",
                },
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = await getDb();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
        <Badge
          variant={
            client.status === "active"
              ? "default"
              : client.status === "paused"
                ? "secondary"
                : "destructive"
          }
        >
          {client.status === "active"
            ? "Actif"
            : client.status === "paused"
              ? "En pause"
              : "Déconnecté"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {[client.primary_category, client.address]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((entry) => (
          <Link
            key={entry.key}
            href={`/clients/${client.id}?tab=${entry.key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === entry.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {tab === "apercu" && <OverviewTab clientId={client.id} />}
      {tab === "reviews" && (
        <ReviewsTab clientId={client.id} clientName={client.name} />
      )}
      {tab === "posts" && <PostsTab client={client} />}
      {tab === "settings" && <ClientSettings client={client} />}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  reply_published: "Réponse publiée",
  reply_auto_published: "Réponse auto-publiée",
  review_ignored: "Review ignorée",
  post_generated: "Post généré",
  post_approved: "Post approuvé",
  post_published: "Post publié",
  generation: "Génération AI",
  sync_completed: "Sync terminé",
  client_settings_updated: "Réglages modifiés",
  brand_profile_updated: "Profil de marque modifié",
};

async function OverviewTab({ clientId }: { clientId: string }) {
  const supabase = await getDb();
  const now = new Date();

  const [{ data: board }, { data: activity }, { data: reviews }] =
    await Promise.all([
      supabase
        .from("client_board_state")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("activity_log")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("reviews")
        .select("star_rating")
        .eq("client_id", clientId),
    ]);

  const avg = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.star_rating, 0) / reviews.length
    : null;
  const remaining = board
    ? remainingPosts({
        postsPerMonth: board.posts_per_month,
        publishedThisMonth: board.posts_published_this_month,
        scheduledThisMonth: board.posts_scheduled_this_month,
      })
    : 0;

  const stats = [
    { label: "Reviews en attente", value: board?.unreplied_count ?? 0 },
    { label: "Drafts de réponses", value: board?.draft_reply_count ?? 0 },
    {
      label: "Posts dus ce mois",
      value: remaining,
      alert: isLate(now, remaining),
    },
    {
      label: "Posts publiés ce mois",
      value: board?.posts_published_this_month ?? 0,
    },
    {
      label: "Note moyenne",
      value: avg !== null ? `${(Math.round(avg * 10) / 10).toFixed(1)} ★` : "—",
    },
    { label: "Total d'avis", value: reviews?.length ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-elevated px-3 py-2.5"
          >
            <div
              className={cn(
                "text-lg font-semibold tabular-nums",
                stat.alert && "text-destructive",
              )}
            >
              {stat.value}
            </div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Activité récente
        </h2>
        {activity?.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-elevated px-4">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <span className="flex-1">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                  <span className="ml-2 text-xs text-muted-foreground">
                    par {entry.actor}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), {
                    addSuffix: true,
                    locale: frCA,
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune activité pour l&apos;instant.
          </p>
        )}
      </section>
    </div>
  );
}

async function ReviewsTab({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const supabase = await getDb();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("client_id", clientId)
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
      clientName,
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

  return <ReviewsInbox reviews={inboxReviews} />;
}

async function PostsTab({
  client,
}: {
  client: {
    id: string;
    name: string;
    posts_per_month: number;
  };
}) {
  const supabase = await getDb();
  const now = new Date();

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("client_id", client.id)
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const cadence = monthlyCadence(posts ?? [], client.posts_per_month, now);

  const queueClients: QueueClient[] = [
    {
      id: client.id,
      name: client.name,
      remaining: cadence.remaining,
      late: cadence.late,
    },
  ];

  const queuePosts: QueuePost[] = (posts ?? []).map((post) => ({
    id: post.id,
    clientId: post.client_id,
    clientName: client.name,
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

  return <PostsView clients={queueClients} posts={queuePosts} />;
}
