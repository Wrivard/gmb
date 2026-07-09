import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import {
  getBoardState,
  getClientsIndex,
  getGoogleConnectionStatus,
} from "@/lib/queries/agency";
import { supabaseConfigured } from "@/lib/env";
import { torontoParts } from "@/lib/due";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { DemoBanner } from "@/components/layout/demo-banner";
import { OpsTabs } from "@/components/layout/ops-tabs";
import {
  ACTION_LABELS,
  ActivityFeed,
  AGENCY_FEED_ACTIONS,
  type ActivityEntry,
} from "@/components/activity/activity-feed";
import { demoActivity, demoBoardClients } from "@/lib/demo";
import { DashboardKanban, type BoardClient } from "./kanban";
import { DashboardHeader } from "./dashboard-header";

export default async function DashboardPage() {
  if (!supabaseConfigured()) {
    const demoClients = demoBoardClients();
    return (
      <div className="flex flex-col gap-5">
        <DemoBanner />
        <OpsTabs />
        <DashboardHeader
          totals={{
            unreplied: demoClients.reduce((sum, c) => sum + c.unreplied, 0),
            postsDue: demoClients.reduce((sum, c) => sum + c.postsDue, 0),
            drafts: demoClients.reduce(
              (sum, c) => sum + c.draftReplies + c.draftPosts,
              0,
            ),
          }}
          connectionStatus={null}
          lastSyncedAt={null}
        />
        <DashboardKanban clients={demoClients} />
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Activité récente
          </h2>
          <ActivityFeed entries={demoActivity()} />
        </section>
      </div>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = await getDb();
  const now = new Date();

  // Loaders partagés avec le layout (React cache) : ces trois requêtes
  // ne partent qu'une fois par navigation, pas deux.
  const [
    { data: board, error: boardError },
    { data: connection },
    { data: clients, error: clientsError },
    { data: activity },
  ] = await Promise.all([
    getBoardState(member.agency_id),
    getGoogleConnectionStatus(member.agency_id),
    getClientsIndex(member.agency_id),
    supabase
      .from("activity_log")
      .select("id, action, actor, client_id, created_at")
      .eq("agency_id", member.agency_id)
      .in("action", AGENCY_FEED_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  // Un échec de requête ne doit jamais se déguiser en tableau vide
  // (« rien à faire ») : on laisse error.tsx afficher l'état d'erreur.
  if (boardError || clientsError) {
    throw new Error((boardError ?? clientsError)!.message);
  }

  const clientMeta = new Map((clients ?? []).map((c) => [c.id, c]));

  // Note moyenne + total de reviews par client (pied de carte).
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("client_id, star_rating")
    .in("client_id", [...clientMeta.keys()]);
  const ratingByClient = new Map<string, { avg: number; count: number }>();
  for (const review of allReviews ?? []) {
    const entry = ratingByClient.get(review.client_id) ?? { avg: 0, count: 0 };
    entry.avg += review.star_rating;
    entry.count += 1;
    ratingByClient.set(review.client_id, entry);
  }
  for (const entry of ratingByClient.values()) {
    entry.avg = entry.avg / entry.count;
  }

  const pastDay20 = torontoParts(now).day > 20;
  const boardClients: BoardClient[] = (board ?? []).map((row) => {
    const meta = clientMeta.get(row.client_id);
    const rating = ratingByClient.get(row.client_id);
    const reviewLate = Boolean(
      row.oldest_pending_review_at &&
        Date.now() - new Date(row.oldest_pending_review_at).getTime() >
          72 * 3600_000,
    );
    return {
      id: row.client_id,
      name: row.name,
      category: meta?.primary_category ?? null,
      city: meta?.address?.split(",").at(-2)?.trim() ?? null,
      unreplied: row.unreplied_count,
      worstPendingRating: row.worst_pending_rating,
      postsDue: row.posts_due,
      postsPerMonth: row.posts_per_month,
      draftReplies: row.draft_reply_count,
      draftPosts: row.draft_post_count,
      avgRating: rating ? Math.round(rating.avg * 10) / 10 : null,
      reviewCount: rating?.count ?? 0,
      late: reviewLate || (row.posts_due > 0 && pastDay20),
    };
  });

  const lastSync = (clients ?? [])
    .map((c) => c.last_synced_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const totals = {
    unreplied: boardClients.reduce((sum, c) => sum + c.unreplied, 0),
    postsDue: boardClients.reduce((sum, c) => sum + c.postsDue, 0),
    drafts: boardClients.reduce(
      (sum, c) => sum + c.draftReplies + c.draftPosts,
      0,
    ),
  };

  // Qui a fait quoi, tous projets confondus — le coup d'œil gestionnaire
  // et la trace d'audit légère, sans ouvrir chaque fiche.
  const feedEntries: ActivityEntry[] = (activity ?? []).map((entry) => {
    const client = entry.client_id
      ? clientMeta.get(entry.client_id)
      : undefined;
    return {
      id: entry.id,
      label: ACTION_LABELS[entry.action] ?? entry.action,
      actor: entry.actor,
      at: entry.created_at,
      client: client ? { id: client.id, name: client.name } : null,
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <RealtimeRefresh />
      <OpsTabs />
      <DashboardHeader
        totals={totals}
        connectionStatus={connection?.status ?? null}
        lastSyncedAt={lastSync ?? null}
      />
      <DashboardKanban clients={boardClients} />
      {feedEntries.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Activité récente
          </h2>
          <ActivityFeed entries={feedEntries} />
        </section>
      )}
    </div>
  );
}
