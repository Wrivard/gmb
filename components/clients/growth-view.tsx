"use client";

// Vue Croissance d'un projet — tendances long terme en vrais graphiques
// (Recharts via le wrapper shadcn). Mono-série : la couleur ne porte
// jamais l'identité seule, chaque valeur a son label texte au survol.
// C'est l'écran du meeting client.

import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { ClientGrowth } from "@/lib/clients/growth";

function fr1(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

// Entrée en douceur : les cartes montent en cascade, les charts
// s'animent ensuite d'eux-mêmes (animation de tracé Recharts).
const cardMotion = (index: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: index * 0.07, ease: "easeOut" as const },
});

const ratingConfig = {
  note: { label: "Note moyenne", color: "var(--chart-1)" },
} satisfies ChartConfig;

const reviewsConfig = {
  reviews: { label: "Reviews", color: "var(--chart-1)" },
} satisfies ChartConfig;

const coverageConfig = {
  publies: { label: "Publiés", color: "var(--success)" },
} satisfies ChartConfig;

export function GrowthView({ growth }: { growth: ClientGrowth }) {
  const current = growth.months.at(-1);

  const ratingData = growth.months.map((m) => ({
    label: m.label,
    note: m.avgCumulative,
  }));
  const ratedPoints = ratingData.filter((d) => d.note !== null);
  const ratingDomain: [number, number] = [
    Math.max(
      1,
      Math.floor(Math.min(...ratedPoints.map((d) => d.note ?? 5)) * 2) / 2 -
        0.5,
    ),
    5,
  ];

  const reviewsData = growth.months.map((m) => ({
    label: m.label,
    reviews: m.reviews,
  }));

  const coverageData = growth.months.map((m, index) => ({
    label: m.label,
    publies: m.postsPublished,
    cible: m.postsTarget,
    isCurrent: index === growth.months.length - 1,
  }));
  const coverageMax = Math.max(
    ...coverageData.map((d) => Math.max(d.publies, d.cible)),
    1,
  );

  const responsePct = growth.responseRate
    ? Math.round(
        (growth.responseRate.replied / growth.responseRate.total) * 100,
      )
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {/* Note moyenne — la métrique maîtresse */}
        <motion.div
          {...cardMotion(0)}
          className="rounded-lg border border-border bg-elevated px-4 py-3"
        >
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
          {ratedPoints.length >= 2 ? (
            <ChartContainer
              config={ratingConfig}
              className="mt-2 h-20 w-full"
              aria-label={`Évolution de la note : ${ratedPoints
                .map((d) => fr1(d.note ?? 0))
                .join(" → ")}`}
            >
              <AreaChart
                data={ratingData}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="fill-note" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-note)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-note)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis domain={ratingDomain} hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums">
                          {fr1(Number(value))} ★
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="note"
                  type="monotone"
                  stroke="var(--color-note)"
                  strokeWidth={2}
                  fill="url(#fill-note)"
                  connectNulls
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="mt-2 flex h-20 items-center text-xs text-muted-foreground">
              Pas encore assez d&apos;historique pour une tendance.
            </p>
          )}
        </motion.div>

        {/* Volume de reviews */}
        <motion.div
          {...cardMotion(1)}
          className="rounded-lg border border-border bg-elevated px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">Reviews reçues / mois</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {current?.reviews ?? 0}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ce mois-ci
            </span>
          </p>
          <ChartContainer
            config={reviewsConfig}
            className="mt-2 h-20 w-full"
            aria-label={`Reviews par mois : ${reviewsData
              .map((d) => `${d.label} ${d.reviews}`)
              .join(", ")}`}
          >
            <BarChart
              data={reviewsData}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <ChartTooltip
                cursor={{ fill: "var(--color-hover)", opacity: 0.5 }}
                content={<ChartTooltipContent hideIndicator />}
              />
              <Bar
                dataKey="reviews"
                fill="var(--color-reviews)"
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                minPointSize={3}
              />
            </BarChart>
          </ChartContainer>
        </motion.div>

        {/* Réponses aux avis */}
        <motion.div
          {...cardMotion(2)}
          className="rounded-lg border border-border bg-elevated px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">Réponses aux avis</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {responsePct !== null ? `${responsePct} %` : "—"}
            {growth.responseRate && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {growth.responseRate.replied}/{growth.responseRate.total}
              </span>
            )}
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            {responsePct !== null && (
              <motion.div
                className="h-full rounded-full bg-chart-1"
                initial={{ width: 0 }}
                animate={{ width: `${responsePct}%` }}
                transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
              />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {growth.medianResponseHours !== null
              ? `Délai médian : ${growth.medianResponseHours} h`
              : "Aucune réponse publiée encore"}
          </p>
        </motion.div>
      </div>

      {/* Couverture de la cadence */}
      <motion.div
        {...cardMotion(3)}
        className="rounded-lg border border-border bg-elevated px-4 py-3"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-muted-foreground">
            Couverture de la cadence — 6 derniers mois
          </p>
          {current && current.postsTarget > 0 && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              <span className="mr-3 inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success/80" /> couvert
              </span>
              <span className="mr-3 inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning/70" /> manqué
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted" /> en cours
              </span>
            </p>
          )}
        </div>
        {current && current.postsTarget > 0 ? (
          <ChartContainer
            config={coverageConfig}
            className="mt-2 h-28 w-full"
            aria-label={`Posts publiés par mois : ${coverageData
              .map((d) => `${d.label} ${d.publies}/${d.cible}`)
              .join(", ")}`}
          >
            <BarChart
              data={coverageData}
              margin={{ top: 14, right: 0, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                interval={0}
                tickFormatter={(label: string, index: number) => {
                  const month = coverageData[index];
                  return `${label} ${month.publies}/${month.cible}${month.isCurrent ? "…" : ""}`;
                }}
              />
              <YAxis domain={[0, coverageMax]} hide />
              <ChartTooltip
                cursor={{ fill: "var(--color-hover)", opacity: 0.5 }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(value, _name, item) => {
                      const month = item?.payload as
                        | (typeof coverageData)[number]
                        | undefined;
                      return (
                        <span className="font-mono font-medium tabular-nums">
                          {Number(value)}/{month?.cible ?? "?"} publié
                          {Number(value) > 1 ? "s" : ""}
                        </span>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="publies"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                minPointSize={3}
              >
                {coverageData.map((month) => (
                  <Cell
                    key={month.label}
                    fill={
                      month.isCurrent
                        ? "var(--muted)"
                        : month.publies >= month.cible
                          ? "var(--success)"
                          : "var(--warning)"
                    }
                    fillOpacity={month.isCurrent ? 1 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Mandat sans posts (reviews seulement) — rien à couvrir.
          </p>
        )}
      </motion.div>
    </div>
  );
}
