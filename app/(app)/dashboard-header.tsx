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
  const stats = [
    {
      value: totals.unreplied,
      label: `review${totals.unreplied > 1 ? "s" : ""} en attente`,
    },
    {
      value: totals.postsDue,
      label: `post${totals.postsDue > 1 ? "s" : ""} dus ce mois`,
    },
    {
      value: totals.drafts,
      label: `brouillon${totals.drafts > 1 ? "s" : ""} à approuver`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Les 3 chiffres de la journée : les nombres portent le poids
          visuel, pas la phrase — c'est l'ancre du tableau. */}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {stats.map((stat) => (
          <span key={stat.label} className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-base font-semibold tabular-nums",
                stat.value === 0 && "text-muted-foreground",
              )}
            >
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </span>
        ))}
      </div>

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
