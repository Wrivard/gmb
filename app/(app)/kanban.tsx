"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GoldStar } from "@/components/reviews/star-rating";
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
  failedPosts: number;
  avgRating: number | null;
  reviewCount: number;
  late: boolean;
  assigneeMemberId: string | null;
  profileIncomplete: boolean;
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
  // Un échec de publication est du travail posts prioritaire : sans ça,
  // l'échec du cron overnight n'apparaissait nulle part sur le tableau.
  if (client.failedPosts > 0 || client.postsDue > 0) return "posts";
  if (client.draftPosts > 0 || client.draftReplies > 0) return "approval";
  return "ok";
}

const MINE_ONLY_KEY = "kua:mes-projets";

export function DashboardKanban({
  clients,
  currentMemberId = null,
}: {
  clients: BoardClient[];
  currentMemberId?: string | null;
}) {
  const [mineOnly, setMineOnly] = useState(false);
  useEffect(() => {
    setMineOnly(localStorage.getItem(MINE_ONLY_KEY) === "1");
  }, []);

  // Le toggle n'a de sens que si l'assignation est utilisée.
  const assignmentInUse =
    currentMemberId !== null &&
    clients.some((client) => client.assigneeMemberId !== null);

  const visibleClients =
    mineOnly && assignmentInUse
      ? clients.filter((client) => client.assigneeMemberId === currentMemberId)
      : clients;

  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, BoardClient[]> = {
      reviews: [],
      posts: [],
      approval: [],
      ok: [],
    };
    for (const client of visibleClients) map[columnOf(client)].push(client);
    return map;
  }, [visibleClients]);

  return (
    <div className="flex flex-col gap-3">
      {assignmentInUse && (
        <label className="flex cursor-pointer items-center gap-2 self-end text-xs text-muted-foreground">
          <Switch
            checked={mineOnly}
            onCheckedChange={(checked) => {
              setMineOnly(Boolean(checked));
              localStorage.setItem(MINE_ONLY_KEY, checked ? "1" : "0");
            }}
            aria-label="N'afficher que mes projets"
          />
          Mes projets
        </label>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <section key={column.key} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
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
              <div className="rounded-md border border-dashed border-border px-2 py-4 text-center text-xs text-muted-foreground">
                {column.empty}
              </div>
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

  // Urgence réelle : avis ≤ 2★ en attente, retard, ou publication en
  // échec chez Google. Elle seule a droit au rouge — quand chaque carte
  // était encadrée de rouge, plus aucune ne ressortait.
  const lowRating =
    client.unreplied > 0 &&
    client.worstPendingRating !== null &&
    client.worstPendingRating <= 2;
  const urgent = client.late || client.failedPosts > 0 || lowRating;

  const drafts = client.draftReplies + client.draftPosts;
  // Les faits, sur une ligne, sans pastille. Une pastille par fait
  // transformait chaque carte en tableau de bord miniature.
  const facts = [
    client.unreplied > 0 &&
      `${client.unreplied} avis`,
    client.postsDue > 0 &&
      `${client.postsDue} post${client.postsDue > 1 ? "s" : ""} à faire`,
    drafts > 0 && `${drafts} brouillon${drafts > 1 ? "s" : ""}`,
  ].filter(Boolean) as string[];

  return (
    <div className="group rounded-md border border-border bg-elevated p-3 transition-colors hover:border-ring/50">
      <Link
        href={`/clients/${client.id}`}
        className="flex items-start gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {client.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {client.category ?? "—"}
          </span>
        </span>
        {client.avgRating !== null && (
          <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <GoldStar />
            {client.avgRating.toFixed(1)}
          </span>
        )}
      </Link>

      {/* L'exception, nommée — seulement quand il y en a une. */}
      {urgent && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
          {client.failedPosts > 0
            ? `${client.failedPosts} publication${client.failedPosts > 1 ? "s" : ""} en échec`
            : lowRating
              ? `Un avis ${client.worstPendingRating}★ attend une réponse`
              : // « En retard » seul ne disait pas QUOI : la colonne le dit.
                column === "reviews"
                ? "Avis sans réponse depuis plus de 72 h"
                : "Posts du mois en retard"}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {facts.join(" · ")}
        </span>
        <span className="flex shrink-0 gap-1">
          {column === "reviews" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              render={<Link href={`/clients/${client.id}?tab=reviews`} />}
            >
              <MessageSquare />
              Répondre
            </Button>
          )}
          {/* Une action par carte : celle de sa colonne. Deux boutons
              tronquaient la ligne de faits. */}
          {column === "posts" && client.postsDue > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
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
