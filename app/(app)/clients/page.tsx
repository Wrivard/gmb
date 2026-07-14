import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { DemoBanner } from "@/components/layout/demo-banner";
import { demoBoardClients, demoClientRows } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientActiveToggle } from "@/app/(app)/settings/client-toggle";
import { Button } from "@/components/ui/button";
import { GoldStar } from "@/components/reviews/star-rating";
import { isBrandProfileIncomplete } from "@/lib/clients/brand-profile";
import { onboardingCtx, onboardingProgress } from "@/lib/onboarding/steps";
import { Plus } from "lucide-react";
import { AssigneeSelect } from "./assignee-select";
import { CadenceSelect } from "./cadence-select";

export const metadata = { title: "Projets" };

// La seule liste des entreprises de l'app (l'ancien tableau « Fiches
// clients » de Réglages a fusionné ici). Le mandat de chaque projet est
// visible et éditable inline — les besoins différents par client se
// voient d'un coup d'œil.

interface ProjectRow {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  avgRating: number | null;
  reviewCount: number;
  unreplied: number;
  drafts: number;
  coverage: { done: number; target: number } | null;
  assigneeMemberId: string | null;
  profileIncomplete: boolean;
  /** Score d'optimisation de la fiche (null = 100 %, rien à afficher). */
  onboardingPct: number | null;
  status: "active" | "paused" | "disconnected";
  cadence: {
    id: string;
    posts_per_month: number;
    language: string;
    auto_publish_replies: boolean;
    auto_publish_posts: boolean;
    status: string;
  };
}

export default async function ClientsPage() {
  const demo = !supabaseConfigured();
  let rows: ProjectRow[] = [];
  let members: Array<{ id: string; email: string }> = [];

  if (demo) {
    const boardById = new Map(demoBoardClients().map((c) => [c.id, c]));
    rows = demoClientRows().map((client) => {
      const board = boardById.get(client.id);
      return {
        id: client.id,
        name: client.name,
        address: client.address,
        category: client.primary_category,
        avgRating: board?.avgRating ?? null,
        reviewCount: board?.reviewCount ?? 0,
        unreplied: board?.unreplied ?? 0,
        drafts: (board?.draftReplies ?? 0) + (board?.draftPosts ?? 0),
        coverage:
          client.posts_per_month > 0
            ? {
                done: Math.max(
                  client.posts_per_month - (board?.postsDue ?? 0),
                  0,
                ),
                target: client.posts_per_month,
              }
            : null,
        assigneeMemberId: null,
        profileIncomplete: false,
        onboardingPct: null,
        status: client.status,
        cadence: {
          id: client.id,
          posts_per_month: client.posts_per_month,
          language: "fr-CA",
          auto_publish_replies: true,
          auto_publish_posts: false,
          status: client.status,
        },
      };
    });
  } else {
    const { member } = await getSessionContext();
    if (!member) return null; // Le layout gère la whitelist.

    const supabase = await getDb();
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", member.agency_id)
      .order("name");
    // Ne pas confondre « échec de chargement » et « aucun projet ».
    if (clientsError) throw new Error(clientsError.message);

    // reviews n'a pas d'agency_id : on scope par client_id, sinon la
    // requête balaie la table entière (toutes agences confondues).
    const clientIds = (clients ?? []).map((c) => c.id);
    const [{ data: board }, { data: reviews }, { data: agencyMembers }] =
      await Promise.all([
        supabase
          .from("client_board_state")
          .select("*")
          .eq("agency_id", member.agency_id),
        clientIds.length
          ? supabase
              .from("reviews")
              .select("client_id, star_rating")
              .in("client_id", clientIds)
          : Promise.resolve({
              data: [] as { client_id: string; star_rating: number }[],
            }),
        supabase
          .from("agency_members")
          .select("id, email")
          .eq("agency_id", member.agency_id)
          .order("email"),
      ]);
    members = agencyMembers ?? [];

    const boardById = new Map((board ?? []).map((b) => [b.client_id, b]));
    const ratingByClient = new Map<string, { sum: number; count: number }>();
    for (const review of reviews ?? []) {
      const entry = ratingByClient.get(review.client_id) ?? {
        sum: 0,
        count: 0,
      };
      entry.sum += review.star_rating;
      entry.count += 1;
      ratingByClient.set(review.client_id, entry);
    }

    // Les archivés (offboardés) sortent de la liste de travail.
    const activeClients = (clients ?? []).filter(
      (c) => c.status !== "archived",
    );
    rows = activeClients.map((client) => {
      const b = boardById.get(client.id);
      const rating = ratingByClient.get(client.id);
      return {
        id: client.id,
        name: client.name,
        address: client.address,
        category: client.primary_category,
        avgRating: rating
          ? Math.round((rating.sum / rating.count) * 10) / 10
          : null,
        reviewCount: rating?.count ?? 0,
        unreplied: b?.unreplied_count ?? 0,
        drafts: (b?.draft_reply_count ?? 0) + (b?.draft_post_count ?? 0),
        coverage:
          client.posts_per_month > 0
            ? {
                done:
                  (b?.posts_published_this_month ?? 0) +
                  (b?.posts_scheduled_this_month ?? 0),
                target: client.posts_per_month,
              }
            : null,
        assigneeMemberId: client.assignee_member_id,
        profileIncomplete: isBrandProfileIncomplete(client.brand_profile),
        onboardingPct: (() => {
          const progress = onboardingProgress(
            onboardingCtx({
              gbp_profile: client.gbp_profile,
              onboarding: client.onboarding,
              brandProfileComplete: !isBrandProfileIncomplete(
                client.brand_profile,
              ),
            }),
          );
          return progress.complete ? null : progress.pct;
        })(),
        status: client.status as ProjectRow["status"],
        cadence: {
          id: client.id,
          posts_per_month: client.posts_per_month,
          language: client.language,
          auto_publish_replies: client.auto_publish_replies,
          auto_publish_posts: client.auto_publish_posts,
          status: client.status,
        },
      };
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {demo && <DemoBanner />}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une ligne par projet : sa note, son mandat, ce qui l&apos;attend.
          </p>
        </div>
        {!demo && (
          <Button
            size="sm"
            className="ml-auto"
            render={<Link href="/clients/new" />}
          >
            <Plus />
            Nouveau projet
          </Button>
        )}
      </div>

      {rows.length ? (
        // Même langage que les autres surfaces : la liste maîtresse de
        // l'app ne flotte pas nue sur le fond de page.
        <div className="overflow-hidden rounded-lg border border-border bg-elevated">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Projet</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Mandat</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Couverture du mois</TableHead>
              <TableHead>En attente</TableHead>
              <TableHead className="text-right">Actif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.status !== "active" ? "opacity-60" : undefined}
              >
                <TableCell>
                  <Link
                    href={`/clients/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {[row.category, row.address].filter(Boolean).join(" · ") ||
                      "—"}
                  </div>
                  {row.onboardingPct !== null && (
                    <Link
                      href={`/clients/${row.id}/onboarding`}
                      className="block text-xs text-warning underline-offset-2 hover:underline"
                    >
                      Fiche optimisée à {row.onboardingPct} % — continuer
                    </Link>
                  )}
                  {row.profileIncomplete && (
                    <Link
                      href={`/clients/${row.id}?tab=settings`}
                      className="block text-xs text-warning underline-offset-2 hover:underline"
                    >
                      Profil incomplet — les drafts AI seront génériques
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  {row.avgRating !== null ? (
                    <span className="flex items-center gap-1 text-sm tabular-nums">
                      <GoldStar />
                      {row.avgRating.toFixed(1)}
                      <span className="text-xs text-muted-foreground">
                        ({row.reviewCount})
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <CadenceSelect
                    client={row.cadence}
                    disabled={demo || row.status === "disconnected"}
                  />
                </TableCell>
                <TableCell>
                  <AssigneeSelect
                    clientId={row.id}
                    assigneeMemberId={row.assigneeMemberId}
                    members={members}
                    disabled={demo || row.status === "disconnected"}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {row.coverage
                    ? `${Math.min(row.coverage.done, row.coverage.target)}/${row.coverage.target} posts`
                    : "n/a"}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {row.unreplied > 0 || row.drafts > 0 ? (
                    <span className="text-muted-foreground">
                      {row.unreplied > 0 &&
                        `${row.unreplied} review${row.unreplied > 1 ? "s" : ""}`}
                      {row.unreplied > 0 && row.drafts > 0 && " · "}
                      {row.drafts > 0 &&
                        `${row.drafts} brouillon${row.drafts > 1 ? "s" : ""}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {row.status === "disconnected" ? (
                    <Badge variant="destructive">Déconnecté</Badge>
                  ) : (
                    <ClientActiveToggle
                      clientId={row.id}
                      active={row.status === "active"}
                      disabled={demo}
                      onboardingIncomplete={row.onboardingPct !== null}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      ) : (
        <EmptyState
          title="Aucun projet"
          hint={
            <>
              Connecte le compte Google dans{" "}
              <Link href="/settings" className="underline">
                Agence
              </Link>
              , les fiches Google seront découvertes automatiquement.
            </>
          }
        />
      )}
    </div>
  );
}
