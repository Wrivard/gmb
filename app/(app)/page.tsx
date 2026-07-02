import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/env";
import { torontoParts } from "@/lib/due";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { DashboardKanban, type BoardClient } from "./kanban";
import { DashboardHeader } from "./dashboard-header";

export default async function DashboardPage() {
  if (!supabaseConfigured()) {
    return (
      <Alert>
        <AlertDescription>
          Supabase n&apos;est pas encore configuré — remplis les variables dans
          `.env.local` (voir PROGRESS.md).
        </AlertDescription>
      </Alert>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = createAdminClient();
  const now = new Date();

  const [{ data: board }, { data: connection }, { data: clients }] =
    await Promise.all([
      supabase
        .from("client_board_state")
        .select("*")
        .eq("agency_id", member.agency_id)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("google_connections")
        .select("status")
        .eq("agency_id", member.agency_id)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("id, primary_category, address, last_synced_at")
        .eq("agency_id", member.agency_id),
    ]);

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

  return (
    <div className="flex flex-col gap-5">
      <RealtimeRefresh />
      <DashboardHeader
        totals={totals}
        connectionStatus={connection?.status ?? null}
        lastSyncedAt={lastSync ?? null}
      />
      <DashboardKanban clients={boardClients} />
    </div>
  );
}
