import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AccessDenied } from "@/components/layout/access-denied";
import { CommandPalette } from "@/components/layout/command-palette";
import { GlobalBanners } from "@/components/layout/global-banners";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import {
  getBoardState,
  getClientsIndex,
  getGoogleConnectionStatus,
} from "@/lib/queries/agency";
import { supabaseConfigured } from "@/lib/env";
import { demoBoardClients } from "@/lib/demo";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let userEmail: string | null = null;
  let userRole: string | null = null;
  let pendingReviews = 0;
  let postsDue = 0;
  let paletteClients: Array<{ id: string; name: string }> = [];
  let connectionRevoked = false;
  let accessPending = false;
  let dataUnavailable = false;

  if (supabaseConfigured()) {
    const { user, member } = await getSessionContext();
    // Le middleware garantit une session; ici on applique la whitelist.
    if (user && !member) {
      return <AccessDenied email={user.email ?? "(sans courriel)"} />;
    }
    userEmail = member?.email ?? user?.email ?? null;
    userRole = member?.role ?? null;

    if (member) {
      const supabase = await getDb();
      const [
        { data: board, error: boardError },
        { data: connection },
        { data: pendingLog },
        { data: clients, error: clientsError },
      ] = await Promise.all([
        getBoardState(member.agency_id),
        getGoogleConnectionStatus(member.agency_id),
        supabase
          .from("activity_log")
          .select("id")
          .eq("agency_id", member.agency_id)
          .eq("action", "gbp_access_pending")
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 3600_000).toISOString(),
          )
          .limit(1),
        getClientsIndex(member.agency_id),
      ]);

      pendingReviews = (board ?? []).reduce(
        (sum, row) => sum + row.unreplied_count,
        0,
      );
      postsDue = (board ?? []).reduce((sum, row) => sum + row.posts_due, 0);
      connectionRevoked = connection?.status === "revoked";
      accessPending = Boolean(pendingLog?.length);
      paletteClients = (clients ?? [])
        .filter((c) => c.status !== "disconnected" && c.status !== "archived")
        .map(({ id, name }) => ({ id, name }));
      // Une requête échouée ne doit pas se déguiser en « 0 en attente » :
      // on l'affiche comme un état dégradé, pas comme un succès.
      dataUnavailable = Boolean(boardError || clientsError);
    }
  } else {
    // Mode exemple (lib/demo.ts) : shell rempli sans backend.
    const demoClients = demoBoardClients();
    userEmail = "demo@kua.quebec";
    userRole = "owner";
    pendingReviews = demoClients.reduce((sum, c) => sum + c.unreplied, 0);
    postsDue = demoClients.reduce((sum, c) => sum + c.postsDue, 0);
    paletteClients = demoClients.map(({ id, name }) => ({ id, name }));
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        userEmail={userEmail}
        userRole={userRole}
        pendingReviews={pendingReviews}
        postsDue={postsDue}
      />
      <div className="lg:pl-60 print:pl-0">
        <GlobalBanners
          connectionRevoked={connectionRevoked}
          accessPending={accessPending}
          dataUnavailable={dataUnavailable}
        />
        <Topbar />
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </div>
      <CommandPalette clients={paletteClients} />
    </div>
  );
}
