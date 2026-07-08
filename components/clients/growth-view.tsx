// Vue Croissance d'un projet — tendances long terme. Micro-charts SVG
// mono-série (pas de lib) : la couleur ne porte jamais l'identité seule,
// chaque barre/statut a son label texte. C'est l'écran du meeting client.

import { cn } from "@/lib/utils";
import type { ClientGrowth } from "@/lib/clients/growth";

function fr1(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

function Sparkline({ values }: { values: Array<number | null> }) {
  const points = values
    .map((v, i) => (v === null ? null : ([i, v] as const)))
    .filter((p): p is readonly [number, number] => p !== null);
  if (points.length < 2) return null;

  const ys = points.map(([, v]) => v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const coords = points
    .map(
      ([i, v]) =>
        `${(i / (values.length - 1)) * 100},${18 - ((v - min) / span) * 14 - 2}`,
    )
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      className="h-5 w-full"
      role="img"
      aria-label={`Évolution : ${points.map(([, v]) => fr1(v)).join(" → ")}`}
    >
      <polyline
        points={coords}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function GrowthView({ growth }: { growth: ClientGrowth }) {
  const current = growth.months.at(-1);
  const maxReviews = Math.max(...growth.months.map((m) => m.reviews), 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {/* Note moyenne — la métrique maîtresse */}
        <div className="rounded-lg border border-border bg-elevated px-4 py-3">
          <p className="text-xs text-muted-foreground">Note moyenne</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {growth.avgRating !== null ? fr1(growth.avgRating) : "—"}
            {growth.avgDelta6m !== null && growth.avgDelta6m !== 0 && (
              <span
                className={cn(
                  "ml-2 text-xs font-medium",
                  growth.avgDelta6m > 0 ? "text-success" : "text-warning",
                )}
              >
                {growth.avgDelta6m > 0 ? "↗ +" : "↘ "}
                {fr1(growth.avgDelta6m)} sur 6 mois
              </span>
            )}
          </p>
          <div className="mt-2">
            <Sparkline values={growth.months.map((m) => m.avgCumulative)} />
          </div>
        </div>

        {/* Volume de reviews */}
        <div className="rounded-lg border border-border bg-elevated px-4 py-3">
          <p className="text-xs text-muted-foreground">Reviews reçues / mois</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {current?.reviews ?? 0}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ce mois-ci
            </span>
          </p>
          <div className="mt-2 flex h-5 items-end gap-1">
            {growth.months.map((month) => (
              <div
                key={month.key}
                title={`${month.label} : ${month.reviews} review${month.reviews > 1 ? "s" : ""}`}
                className="flex-1 rounded-sm bg-[var(--chart-1)]/70"
                style={{
                  height: `${Math.max((month.reviews / maxReviews) * 100, 6)}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Réponses aux avis */}
        <div className="rounded-lg border border-border bg-elevated px-4 py-3">
          <p className="text-xs text-muted-foreground">Réponses aux avis</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {growth.responseRate
              ? `${Math.round(
                  (growth.responseRate.replied / growth.responseRate.total) *
                    100,
                )} %`
              : "—"}
            {growth.responseRate && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {growth.responseRate.replied}/{growth.responseRate.total}
              </span>
            )}
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            {growth.responseRate && (
              <div
                className="h-full rounded-full bg-[var(--chart-1)]"
                style={{
                  width: `${(growth.responseRate.replied / growth.responseRate.total) * 100}%`,
                }}
              />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {growth.medianResponseHours !== null
              ? `Délai médian : ${growth.medianResponseHours} h`
              : "Aucune réponse publiée encore"}
          </p>
        </div>
      </div>

      {/* Couverture de la cadence */}
      <div className="rounded-lg border border-border bg-elevated px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Couverture de la cadence — 6 derniers mois
        </p>
        {current && current.postsTarget > 0 ? (
          <div className="mt-2 flex items-end gap-2">
            {growth.months.map((month, index) => {
              const isCurrent = index === growth.months.length - 1;
              const covered = month.postsPublished >= month.postsTarget;
              return (
                <div
                  key={month.key}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${month.label} : ${month.postsPublished}/${month.postsTarget} posts publiés`}
                >
                  <div className="flex h-8 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-sm",
                        isCurrent
                          ? "bg-muted"
                          : covered
                            ? "bg-success/80"
                            : "bg-warning/70",
                      )}
                      style={{
                        height: `${Math.max(
                          Math.min(
                            month.postsPublished / month.postsTarget,
                            1,
                          ) * 100,
                          8,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {month.label} {month.postsPublished}/{month.postsTarget}
                    {isCurrent && "…"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Mandat sans posts (reviews seulement) — rien à couvrir.
          </p>
        )}
      </div>
    </div>
  );
}
