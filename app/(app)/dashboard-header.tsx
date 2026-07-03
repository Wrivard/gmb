import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { frCA } from "date-fns/locale";
import { Button } from "@/components/ui/button";
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
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.unreplied} review{totals.unreplied > 1 ? "s" : ""} en attente
          · {totals.postsDue} post{totals.postsDue > 1 ? "s" : ""} dus ce mois ·{" "}
          {totals.drafts} draft{totals.drafts > 1 ? "s" : ""} à approuver
        </p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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

        {totals.unreplied > 0 ? (
          <Button size="sm" render={<Link href="/reviews" />}>
            Traiter les reviews ({totals.unreplied})
          </Button>
        ) : totals.postsDue > 0 ? (
          <Button size="sm" render={<Link href="/posts" />}>
            Générer les posts dus ({totals.postsDue})
          </Button>
        ) : null}
      </div>
    </div>
  );
}
