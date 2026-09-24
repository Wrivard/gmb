import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ClientHealth, HealthStatus } from "@/lib/clients/health";

// Une lecture, trois piliers. Le wizard répond « la fiche est-elle bien
// montée ? » et se termine ; cette carte répond « le mandat va-t-il
// bien ? » et ne se termine jamais.

const TONE: Record<HealthStatus, { dot: string; text: string; ring: string }> = {
  ok: {
    dot: "bg-success",
    text: "text-success",
    ring: "border-success/30 bg-success/5",
  },
  warn: {
    dot: "bg-warning",
    text: "text-warning",
    ring: "border-warning/30 bg-warning/10",
  },
  critical: {
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "border-destructive/30 bg-destructive/10",
  },
};

const LABEL: Record<HealthStatus, string> = {
  ok: "En santé",
  warn: "À surveiller",
  critical: "Attention",
};

/** Où agir pour chaque pilier — un titre sans issue ne sert à rien. */
const LINK: Record<string, (clientId: string) => string> = {
  fiche: (id) => `/clients/${id}/onboarding`,
  avis: () => "/reviews",
  posts: () => "/posts",
};

export function ClientHealthCard({
  health,
  clientId,
}: {
  health: ClientHealth;
  clientId: string;
}) {
  const tone = TONE[health.status];

  return (
    <section className={cn("rounded-md border px-4 py-3", tone.ring)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", tone.dot)} />
          <span className={cn("text-sm font-medium", tone.text)}>
            {LABEL[health.status]} — {health.pct} %
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          {health.worst.detail}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {health.pillars.map((pillar) => (
          <Link
            key={pillar.key}
            href={LINK[pillar.key](clientId)}
            className="group rounded border bg-background/60 px-3 py-2 transition-colors hover:bg-background"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {pillar.label}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  TONE[pillar.status].text,
                )}
              >
                {pillar.pct} %
              </span>
            </span>
            {/* Barre plutôt que chiffre seul : trois piliers se comparent
                d'un coup d'œil, pas en lisant trois nombres. */}
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full", TONE[pillar.status].dot)}
                style={{ width: `${Math.max(pillar.pct, 2)}%` }}
              />
            </span>
            <span className="mt-1.5 block text-xs text-muted-foreground group-hover:text-foreground">
              {pillar.detail}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
