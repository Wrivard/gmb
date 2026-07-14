import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { isLate, remainingPosts } from "@/lib/due";
import { HISTORY_PAGE, loadInboxReviews } from "@/lib/reviews/inbox";
import { loadClientQueue } from "@/lib/posts/queue";
import { loadClientGrowth } from "@/lib/clients/growth";
import { onboardingCtx, onboardingProgress } from "@/lib/onboarding/steps";
import { isBrandProfileIncomplete } from "@/lib/clients/brand-profile";
import { GrowthView } from "@/components/clients/growth-view";
import {
  ACTION_LABELS,
  ActivityFeed,
} from "@/components/activity/activity-feed";
import { DemoBanner } from "@/components/layout/demo-banner";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import {
  demoActivity,
  demoBoardClients,
  demoClientGrowth,
  demoClientRows,
  demoInboxReviews,
  demoQueuePosts,
} from "@/lib/demo";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TabBar } from "@/components/ui/tab-bar";
import { cn } from "@/lib/utils";

// Chaque onglet ne charge que son propre JS : import statique = les
// trois gros composants client (dont framer-motion) dans le bundle de
// la route, même pour lire Croissance.
const tabFallback = <Skeleton className="h-64 w-full rounded-lg" />;
const ReviewsInbox = dynamic(
  () =>
    import("@/app/(app)/reviews/reviews-inbox").then((m) => m.ReviewsInbox),
  { loading: () => tabFallback },
);
const PostsView = dynamic(
  () => import("@/app/(app)/posts/posts-view").then((m) => m.PostsView),
  { loading: () => tabFallback },
);
const ClientSettings = dynamic(
  () => import("./client-settings").then((m) => m.ClientSettings),
  { loading: () => tabFallback },
);

export const metadata = { title: "Projet" };

const TABS = [
  { key: "croissance", label: "Croissance" },
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
  searchParams: Promise<{ tab?: string; hist?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, hist } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : "croissance";
  const historyLimit = Math.min(
    Math.max(Number(hist) || HISTORY_PAGE, HISTORY_PAGE),
    1500,
  );

  if (!supabaseConfigured()) {
    const board = demoBoardClients().find((c) => c.id === id);
    if (!board) notFound();
    const row = demoClientRows().find((c) => c.id === id);
    const reviews = demoInboxReviews().filter((r) => r.clientId === id);
    const posts = demoQueuePosts().filter((p) => p.clientId === id);

    const stats = [
      { label: "Reviews en attente", value: board.unreplied },
      { label: "Brouillons à approuver", value: board.draftReplies + board.draftPosts },
      { label: "Posts dus ce mois", value: board.postsDue, alert: board.late },
    ];

    return (
      <div className="flex flex-col gap-5">
        <DemoBanner />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/clients" />}>
            <ArrowLeft />
            Projets
          </Button>
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

        <TabBar
          activeKey={tab}
          items={TABS.map((entry) => ({
            key: entry.key,
            label: entry.label,
            href: `/clients/${id}?tab=${entry.key}`,
          }))}
        />

        {tab === "croissance" && (
          <div className="flex flex-col gap-6">
            <GrowthView growth={demoClientGrowth()} />
            <div className="grid gap-2 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border bg-elevated px-4 py-3"
                >
                  <div
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
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
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Activité récente
              </h2>
              <ActivityFeed entries={demoActivity()} />
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
            backHref={`/clients/${board.id}?tab=posts`}
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
                internal_notes: null,
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
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  // Erreur de requête ≠ projet inexistant : ne pas rendre un faux 404.
  if (error) throw new Error(error.message);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-5">
      {/* Même filet temps réel que /posts et /reviews : un cron ou un
          collègue (ou l'image différée d'un post) met la page à jour. */}
      <RealtimeRefresh />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/clients" />}>
          <ArrowLeft />
          Projets
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
        <Badge
          variant={
            client.status === "active"
              ? "default"
              : client.status === "paused"
                ? "secondary"
                : client.status === "archived"
                  ? "ghost"
                  : "destructive"
          }
        >
          {client.status === "active"
            ? "Actif"
            : client.status === "paused"
              ? "En pause"
              : client.status === "archived"
                ? "Archivé"
                : "Déconnecté"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {[client.primary_category, client.address]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {/* Résumé du mandat : la différence entre clients, lisible en 1 s. */}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {client.posts_per_month} post
            {client.posts_per_month > 1 ? "s" : ""}/mois
            {client.auto_publish_replies && " · réponses auto ≥4★"}
            {client.auto_publish_posts && " · posts auto"} ·{" "}
            {client.language}
          </span>
          <Link
            href={`/clients/${client.id}?tab=settings`}
            className="text-primary transition-colors hover:underline"
          >
            Modifier
          </Link>
        </span>
      </div>

      {/* Onboarding inachevé : le rappel vit sur le projet lui-même,
          pas seulement dans la liste — personne ne « passe à côté ». */}
      {(() => {
        // Un projet offboardé ou déconnecté n'a plus d'onboarding à faire.
        if (client.status === "archived" || client.status === "disconnected")
          return null;
        const progress = onboardingProgress(
          onboardingCtx({
            gbp_profile: client.gbp_profile,
            onboarding: client.onboarding,
            brandProfileComplete: !isBrandProfileIncomplete(
              client.brand_profile,
            ),
          }),
        );
        if (progress.complete) return null;
        return (
          <Link
            href={`/clients/${client.id}/onboarding`}
            className="group flex items-center gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm transition-colors hover:bg-warning/15"
          >
            <span className="font-medium text-warning">
              Fiche optimisée à {progress.pct} %
            </span>
            <span className="text-muted-foreground">
              {progress.done}/{progress.total} points de la checklist —
              l&apos;optimisation initiale est ce qui fait ranker.
            </span>
            <span className="ml-auto text-xs font-medium text-warning group-hover:underline">
              Continuer →
            </span>
          </Link>
        );
      })()}

      {/* Consigne d'équipe : toujours sous les yeux, peu importe l'onglet. */}
      {client.internal_notes && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <span className="font-medium">Note interne :</span>{" "}
          {client.internal_notes}
        </p>
      )}

      <TabBar
        activeKey={tab}
        items={TABS.map((entry) => ({
          key: entry.key,
          label: entry.label,
          href: `/clients/${client.id}?tab=${entry.key}`,
        }))}
      />

      {tab === "croissance" && <GrowthTab client={client} />}
      {tab === "reviews" && (
        <ReviewsTab
          clientId={client.id}
          clientName={client.name}
          historyLimit={historyLimit}
        />
      )}
      {tab === "posts" && <PostsTab client={client} />}
      {tab === "settings" && (
        <ClientSettings client={client} isOwner={member.role === "owner"} />
      )}
    </div>
  );
}

async function GrowthTab({
  client,
}: {
  client: { id: string; posts_per_month: number };
}) {
  const reportHref = `/clients/${client.id}/rapport`;
  const supabase = await getDb();
  const now = new Date();

  const [growth, { data: board }, { data: activity }] = await Promise.all([
    loadClientGrowth(client, now),
    supabase
      .from("client_board_state")
      .select("*")
      .eq("client_id", client.id)
      .maybeSingle(),
    supabase
      .from("activity_log")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const remaining = board
    ? remainingPosts({
        postsPerMonth: board.posts_per_month,
        publishedThisMonth: board.posts_published_this_month,
        scheduledThisMonth: board.posts_scheduled_this_month,
      })
    : 0;

  // Le pouls du moment en 3 chiffres — le reste (note, volume, couverture)
  // est porté par les tendances de GrowthView.
  const stats = [
    { label: "Reviews en attente", value: board?.unreplied_count ?? 0 },
    {
      label: "Brouillons à approuver",
      value: (board?.draft_reply_count ?? 0) + (board?.draft_post_count ?? 0),
    },
    {
      label: "Posts dus ce mois",
      value: remaining,
      alert: isLate(now, remaining),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tendances des 6 derniers mois.
        </p>
        {/* Le livrable du meeting client : le mois précédent, imprimable. */}
        <Button size="sm" variant="outline" render={<Link href={reportHref} />}>
          <FileText />
          Rapport mensuel
        </Button>
      </div>
      <GrowthView growth={growth} />
      <div className="grid gap-2 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-elevated px-4 py-3"
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
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Activité récente
        </h2>
        {activity?.length ? (
          <ActivityFeed
            entries={activity.map((entry) => ({
              id: entry.id,
              label: ACTION_LABELS[entry.action] ?? entry.action,
              actor: entry.actor,
              at: entry.created_at,
            }))}
          />
        ) : (
          <EmptyState size="sm" title="Aucune activité pour l'instant." />
        )}
      </section>
    </div>
  );
}

async function ReviewsTab({
  clientId,
  clientName,
  historyLimit,
}: {
  clientId: string;
  clientName: string;
  historyLimit: number;
}) {
  const inboxReviews = await loadInboxReviews(
    { clientId, clientName },
    { historyLimit },
  );
  return <ReviewsInbox reviews={inboxReviews} historyLimit={historyLimit} />;
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
  const { clients, posts } = await loadClientQueue(client);
  return (
    <PostsView
      clients={clients}
      posts={posts}
      backHref={`/clients/${client.id}?tab=posts`}
    />
  );
}
