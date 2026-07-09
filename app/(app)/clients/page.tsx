import Link from "next/link";
import { Star } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { DemoBanner } from "@/components/layout/demo-banner";
import { demoBoardClients, demoClientRows } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientActiveToggle } from "@/app/(app)/settings/client-toggle";
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
    const [{ data: clients, error: clientsError }, { data: board }, { data: reviews }] =
      await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .eq("agency_id", member.agency_id)
          .order("name"),
        supabase
          .from("client_board_state")
          .select("*")
          .eq("agency_id", member.agency_id),
        supabase
          .from("reviews")
          .select("client_id, star_rating"),
      ]);
    // Ne pas confondre « échec de chargement » et « aucun projet ».
    if (clientsError) throw new Error(clientsError.message);

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

    rows = (clients ?? []).map((client) => {
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
        status: client.status,
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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Projets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une ligne par projet : sa note, son mandat, ce qui l&apos;attend.
        </p>
      </div>

      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projet</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Mandat</TableHead>
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
                </TableCell>
                <TableCell>
                  {row.avgRating !== null ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="size-3 fill-gold text-gold" />
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
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {row.coverage
                    ? `${Math.min(row.coverage.done, row.coverage.target)}/${row.coverage.target} posts`
                    : "n/a"}
                </TableCell>
                <TableCell className="text-sm">
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
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Aucun projet — connecte le compte Google dans{" "}
          <Link href="/settings" className="underline">
            Agence
          </Link>
          , les fiches Google seront découvertes automatiquement.
        </p>
      )}
    </div>
  );
}
