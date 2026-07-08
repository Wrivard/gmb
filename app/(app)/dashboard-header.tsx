import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { frCA } from "date-fns/locale";
import { cn } from "@/lib/utils";

/** Header contextuel du dashboard (specs/08). */
export function DashboardHeader({
  totals,
  connectionStatus,
  lastSyncedAt,
}: {
  totals: { unreplied: number; postsDue: number; drafts: number };
  connectionStatus: "active" | "revoked" | null;
  lastSyncedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-sm text-muted-foreground">
        {totals.unreplied} review{totals.unreplied > 1 ? "s" : ""} en attente ·{" "}
        {totals.postsDue} post{totals.postsDue > 1 ? "s" : ""} dus ce mois ·{" "}
        {totals.drafts} draft{totals.drafts > 1 ? "s" : ""} à approuver
      </p>

      {/* Le tableau ci-dessous EST la réponse à « quoi faire » : pas de
          CTA changeant ici — seulement l'état de la connexion. */}
      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "size-2 rounded-full",
            connectionStatus === "active"
              ? "bg-success"
              : connectionStatus === "revoked"
                ? "bg-destructive"
                : "bg-muted-foreground",
          )}
        />
        {connectionStatus === "revoked" ? (
          <Link href="/settings" className="text-destructive underline">
            Reconnexion requise
          </Link>
        ) : lastSyncedAt ? (
          `Synchronisé ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, locale: frCA })}`
        ) : connectionStatus === "active" ? (
          "Connecté — premier sync à venir"
        ) : (
          <Link href="/settings" className="underline">
            Google non connecté
          </Link>
        )}
      </span>
    </div>
  );
}
