"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, MessageSquare, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generatePostAction } from "./posts/actions";

export interface BoardClient {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  unreplied: number;
  worstPendingRating: number | null;
  postsDue: number;
  postsPerMonth: number;
  draftReplies: number;
  draftPosts: number;
  avgRating: number | null;
  reviewCount: number;
  late: boolean;
}

type ColumnKey = "reviews" | "posts" | "approval" | "ok";

// Couleur = urgence seulement : les têtes de colonnes restent neutres,
// le rouge n'apparaît que sur les cartes réellement urgentes (≤2★, retard).
const COLUMNS: Array<{ key: Exclude<ColumnKey, "ok">; title: string; empty: string }> = [
  {
    key: "reviews",
    title: "Reviews à répondre",
    empty: "Aucune review en attente.",
  },
  { key: "posts", title: "Posts dus", empty: "La cadence du mois est couverte." },
  {
    key: "approval",
    title: "À approuver",
    empty: "Aucun brouillon en attente.",
  },
];

/** Un client = UNE colonne, la plus urgente (specs/08). */
function columnOf(client: BoardClient): ColumnKey {
  if (client.unreplied > 0) return "reviews";
  if (client.postsDue > 0) return "posts";
  if (client.draftPosts > 0 || client.draftReplies > 0) return "approval";
  return "ok";
}

export function DashboardKanban({ clients }: { clients: BoardClient[] }) {
  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, BoardClient[]> = {
      reviews: [],
      posts: [],
      approval: [],
      ok: [],
    };
    for (const client of clients) map[columnOf(client)].push(client);
    return map;
  }, [clients]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <section
            key={column.key}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2"
          >
            <h2 className="flex items-center gap-2 px-1 py-1 text-sm font-medium">
              {column.title}
              <span className="ml-auto font-normal text-muted-foreground tabular-nums">
                {byColumn[column.key].length}
              </span>
            </h2>
            <AnimatePresence initial={false}>
              {byColumn[column.key].map((client) => (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ClientCard client={client} />
                </motion.div>
              ))}
            </AnimatePresence>
            {!byColumn[column.key].length && (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                {column.empty}
              </p>
            )}
          </section>
        ))}
      </div>

      {/* « À jour » : pas d'action à prendre → une rangée compacte, pas
          une colonne de cartes qui grossit avec le nombre de clients. */}
      {byColumn.ok.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-success" />
          <span>
            {byColumn.ok.length} projet{byColumn.ok.length > 1 ? "s" : ""} à
            jour
          </span>
          <span className="text-muted-foreground">
            {byColumn.ok.map((client, index) => (
              <span key={client.id}>
                {index > 0 && " · "}
                <Link
                  href={`/clients/${client.id}`}
                  className="transition-colors hover:text-foreground"
                >
                  {client.name}
                </Link>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function ClientCard({ client }: { client: BoardClient }) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const column = columnOf(client);
  // Urgence réelle : review ≤2★ en attente, ou retard (>72 h / après le 20).
  const urgent =
    client.late ||
    (client.unreplied > 0 &&
      client.worstPendingRating !== null &&
      client.worstPendingRating <= 2);

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-elevated p-3 transition-colors hover:border-ring",
        urgent ? "border-destructive/60" : "border-border",
      )}
    >
      <Link
        href={`/clients/${client.id}`}
        className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="text-sm font-medium">{client.name}</div>
        <div className="text-xs text-muted-foreground">
          {[client.category, client.city].filter(Boolean).join(" · ") || "—"}
        </div>
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {client.unreplied > 0 && (
          <Link href={`/clients/${client.id}?tab=reviews`}>
            <Badge variant={urgent ? "destructive" : "secondary"}>
              {client.unreplied} review{client.unreplied > 1 ? "s" : ""}
              {client.worstPendingRating !== null &&
                client.worstPendingRating <= 2 &&
                ` · dont une ${client.worstPendingRating}★`}
            </Badge>
          </Link>
        )}
        {client.postsDue > 0 && (
          <Link href={`/clients/${client.id}?tab=posts`}>
            <Badge variant="secondary">
              {client.postsDue}/{client.postsPerMonth} post
              {client.postsPerMonth > 1 ? "s" : ""} ce mois
            </Badge>
          </Link>
        )}
        {client.draftReplies + client.draftPosts > 0 && (
          <Badge variant="outline">
            {client.draftReplies + client.draftPosts} brouillon
            {client.draftReplies + client.draftPosts > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {client.avgRating !== null && (
            <>
              <Star className="size-3 fill-gold text-gold" />
              {client.avgRating.toFixed(1)} · {client.reviewCount} avis
            </>
          )}
        </span>

        {/* Actions rapides — toujours visibles : c'est le geste principal. */}
        <span className="flex gap-1">
          {column === "reviews" && (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={`/clients/${client.id}?tab=reviews`} />}
            >
              <MessageSquare />
              Répondre
            </Button>
          )}
          {client.postsDue > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={generating}
              onClick={() =>
                startGenerate(async () => {
                  const result = await generatePostAction(client.id);
                  if (result.ok) {
                    toast.success(`Post généré pour ${client.name}.`);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              <Sparkles />
              {generating ? "…" : "Générer"}
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
