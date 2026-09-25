import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { getAgencyClients } from "@/lib/queries/agency";
import { supabaseConfigured } from "@/lib/env";
import { DemoBanner } from "@/components/layout/demo-banner";
import { demoBoardClients, demoClientRows } from "@/lib/demo";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GoldStar } from "@/components/reviews/star-rating";
import { isBrandProfileIncomplete } from "@/lib/clients/brand-profile";
import { onboardingCtx, onboardingProgress } from "@/lib/onboarding/steps";
import { aggregate } from "@/lib/onboarding/review-stats";
import { clientHealth, type ClientHealth } from "@/lib/clients/health";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { AssigneeSelect } from "./assignee-select";

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
  /** Fiche + avis + publications — null en mode démo. */
  health: ClientHealth | null;
  status: "active" | "paused" | "disconnected";
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
        health: null,
        status: client.status,
      };
    });
  } else {
    const { member } = await getSessionContext();
    if (!member) return null; // Le layout gère la whitelist.

    const supabase = await getDb();
    const { data: clients, error: clientsError } = await getAgencyClients(
      member.agency_id,
    );
    // Ne pas confondre « échec de chargement » et « aucun projet ».
    if (clientsError) throw new Error(clientsError.message);

    // reviews n'a pas d'agency_id : on scope par client_id, sinon la
    // requête balaie la table entière (toutes agences confondues).
    const clientIds = (clients ?? []).map((c) => c.id);
    const [
      { data: board },
      { data: reviews },
      { data: posts },
      { data: agencyMembers },
    ] =
      await Promise.all([
        supabase
          .from("client_board_state")
          .select("*")
          .eq("agency_id", member.agency_id),
        clientIds.length
          ? supabase
              .from("reviews")
              // `comment`, `review_created_at` et `status` alimentent le
              // pilier « avis » de l'état de santé — élargir cette
              // requête évite d'en ajouter une seconde.
              .select(
                "client_id, star_rating, comment, review_created_at, status",
              )
              .in("client_id", clientIds)
          : Promise.resolve({
              data: [] as Array<{
                client_id: string;
                star_rating: number;
                comment: string | null;
                review_created_at: string | null;
                status: string;
              }>,
            }),
        clientIds.length
          ? supabase
              .from("posts")
              .select("client_id, status, published_at")
              .in("client_id", clientIds)
          : Promise.resolve({
              data: [] as Array<{
                client_id: string;
                status: string;
                published_at: string | null;
              }>,
            }),
        supabase
          .from("agency_members")
          .select("id, email")
          .eq("agency_id", member.agency_id)
          .order("email"),
      ]);
    members = agencyMembers ?? [];

    const now = Date.now();
    const since30 = now - 30 * 24 * 60 * 60 * 1000;
    const reviewsByClient = new Map<string, typeof reviews>();
    for (const review of reviews ?? []) {
      const list = reviewsByClient.get(review.client_id) ?? [];
      list.push(review);
      reviewsByClient.set(review.client_id, list);
    }
    const postsByClient = new Map<string, { published30: number; failed: number }>();
    for (const post of posts ?? []) {
      const entry = postsByClient.get(post.client_id) ?? {
        published30: 0,
        failed: 0,
      };
      if (post.status === "failed") entry.failed++;
      if (
        post.status === "published" &&
        post.published_at &&
        new Date(post.published_at).getTime() >= since30
      ) {
        entry.published30++;
      }
      postsByClient.set(post.client_id, entry);
    }

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
        health: clientHealth({
          onboardingPct: onboardingProgress(
            onboardingCtx({
              gbp_profile: client.gbp_profile,
              onboarding: client.onboarding,
              brandProfileComplete: !isBrandProfileIncomplete(
                client.brand_profile,
              ),
            }),
          ).pct,
          reviews: aggregate(reviewsByClient.get(client.id) ?? [], now),
          posts: {
            publishedLast30: postsByClient.get(client.id)?.published30 ?? 0,
            failed: postsByClient.get(client.id)?.failed ?? 0,
            monthlyTarget: client.posts_per_month ?? 0,
          },
        }),
        status: client.status as ProjectRow["status"],
      };
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {demo && <DemoBanner />}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projets</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {rows.length} projet{rows.length > 1 ? "s" : ""}
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
          <TableHeader>
            <TableRow className="hover:bg-transparent [&>th]:h-9 [&>th]:text-xs [&>th]:font-normal [&>th]:text-muted-foreground">
              <TableHead>Projet</TableHead>
              <TableHead className="w-24">Santé</TableHead>
              <TableHead className="w-28">Note</TableHead>
              <TableHead className="w-28">Posts du mois</TableHead>
              <TableHead>À faire</TableHead>
              <TableHead className="w-32 text-right">Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              // Une ligne = ce qu'il faut savoir pour décider où aller.
              // Le détail (adresse, cadence, activation) vit sur la fiche
              // du projet : répété sur chaque ligne, il noyait l'essentiel
              // et forçait un défilement horizontal.
              const todo = [
                row.unreplied > 0 &&
                  `${row.unreplied} avis`,
                row.drafts > 0 &&
                  `${row.drafts} brouillon${row.drafts > 1 ? "s" : ""}`,
                row.profileIncomplete && "profil de marque",
              ].filter(Boolean) as string[];
              return (
                <TableRow
                  key={row.id}
                  className={cn(row.status !== "active" && "opacity-55")}
                >
                  <TableCell className="py-3">
                    <Link
                      href={`/clients/${row.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {row.category ?? "—"}
                      {row.status === "paused" && <span>· en pause</span>}
                      {row.status === "disconnected" && (
                        <span className="text-destructive">· déconnecté</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {row.health ? (
                      <Link
                        href={`/clients/${row.id}`}
                        className="flex items-center gap-2"
                        title={`${row.health.worst.label} — ${row.health.worst.detail}`}
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            row.health.status === "ok" && "bg-success",
                            row.health.status === "warn" && "bg-warning",
                            row.health.status === "critical" && "bg-destructive",
                          )}
                        />
                        <span className="text-sm tabular-nums">
                          {row.health.pct}
                          <span className="text-muted-foreground"> %</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {row.avgRating !== null ? (
                      <span className="flex items-center gap-1 text-sm tabular-nums">
                        <GoldStar />
                        {row.avgRating.toFixed(1)}
                        <span className="text-xs text-muted-foreground">
                          {row.reviewCount}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm tabular-nums">
                    {row.coverage ? (
                      <span
                        className={cn(
                          row.coverage.done >= row.coverage.target
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {Math.min(row.coverage.done, row.coverage.target)}
                        <span className="text-muted-foreground">
                          /{row.coverage.target}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {todo.length ? todo.join(" · ") : "—"}
                  </TableCell>

                  <TableCell className="text-right">
                    <AssigneeSelect
                      clientId={row.id}
                      assigneeMemberId={row.assigneeMemberId}
                      members={members}
                      disabled={demo || row.status === "disconnected"}
                      quiet
                    />
                  </TableCell>
                </TableRow>
              );
            })}
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
