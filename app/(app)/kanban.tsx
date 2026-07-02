"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Sparkles, Star } from "lucide-react";
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
  draftReplies: number;
  draftPosts: number;
  avgRating: number | null;
  reviewCount: number;
  late: boolean;
}

type ColumnKey = "reviews" | "posts" | "approval" | "ok";

const COLUMNS: Array<{ key: ColumnKey; title: string; accent: string }> = [
  { key: "reviews", title: "🔴 Reviews à répondre", accent: "border-t-destructive" },
  { key: "posts", title: "📝 Posts dus", accent: "border-t-amber-500" },
  { key: "approval", title: "⏳ En attente d'approbation", accent: "border-t-blue-500" },
  { key: "ok", title: "✅ À jour", accent: "border-t-emerald-600" },
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((column) => (
        <section
          key={column.key}
          className={cn(
            "flex flex-col gap-2 rounded-lg border border-border border-t-2 bg-background/40 p-2",
            column.accent,
          )}
        >
          <h2 className="px-1 text-sm font-semibold">
            {column.title}{" "}
            <span className="text-muted-foreground">
              ({byColumn[column.key].length})
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
              {column.key === "ok" ? "—" : "Rien ici 🎉"}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function ClientCard({ client }: { client: BoardClient }) {
  const router = useRouter();
  const [generating, startGenerate] = useTransition();
  const column = columnOf(client);

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-elevated p-3 transition-colors hover:border-ring",
        client.late ? "border-destructive/60" : "border-border",
      )}
    >
      <Link href={`/clients/${client.id}`} className="block">
        <div className="text-sm font-medium">{client.name}</div>
        <div className="text-xs text-muted-foreground">
          {[client.category, client.city].filter(Boolean).join(" · ") || "—"}
        </div>
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {client.unreplied > 0 && (
          <Link href={`/clients/${client.id}?tab=reviews`}>
            <Badge variant="destructive">
              {client.unreplied} review{client.unreplied > 1 ? "s" : ""}
              {client.worstPendingRating !== null &&
                client.worstPendingRating <= 2 &&
                ` · dont une ${client.worstPendingRating}★`}
            </Badge>
          </Link>
        )}
        {client.postsDue > 0 && (
          <Link href={`/clients/${client.id}?tab=posts`}>
            <Badge variant="default">
              {client.postsDue} post{client.postsDue > 1 ? "s" : ""} dû
              {client.postsDue > 1 ? "s" : ""}
            </Badge>
          </Link>
        )}
        {client.draftReplies + client.draftPosts > 0 && (
          <Badge variant="secondary">
            {client.draftReplies + client.draftPosts} draft
            {client.draftReplies + client.draftPosts > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {client.avgRating !== null && (
            <>
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {client.avgRating.toFixed(1)} · {client.reviewCount} avis
            </>
          )}
        </span>

        {/* Actions rapides au hover */}
        <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {column === "reviews" && (
            <Button
              size="xs"
              variant="outline"
              render={<Link href={`/clients/${client.id}?tab=reviews`} />}
            >
              <MessageSquare />
              Répondre
            </Button>
          )}
          {client.postsDue > 0 && (
            <Button
              size="xs"
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
