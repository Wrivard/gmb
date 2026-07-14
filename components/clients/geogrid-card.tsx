"use client";

// Carte geogrid (onglet Croissance) : où la fiche sort dans Google
// Maps autour de l'adresse, mot-clé par mot-clé — grille 7×7 colorée
// par rang, scan mensuel automatique. Version minimale : pas de scan à
// la demande, pas d'historique — la dernière photo du mois suffit.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GEOGRID_MAX_KEYWORDS } from "@/lib/geogrid/grid";
import { updateGeogridKeywordsAction } from "@/app/(app)/clients/[id]/actions";
import type { GeogridScan } from "@/lib/types/database";

export function GeogridCard({
  clientId,
  keywords,
  suggestion,
  scans,
}: {
  clientId: string;
  keywords: string[];
  /** Suggestion de premier mot-clé (catégorie du client). */
  suggestion: string | null;
  /** Dernier scan par mot-clé configuré. */
  scans: GeogridScan[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(keywords.length === 0);
  const [draft, setDraft] = useState(keywords.join(", "));
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const result = await updateGeogridKeywordsAction(clientId, draft);
      if (result.ok) {
        toast.success(
          draft.trim()
            ? "Mots-clés enregistrés — scan au prochain passage du cron."
            : "Suivi local désactivé.",
        );
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-elevated p-5">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="size-4 text-muted-foreground" />
            Positions locales (géogrille)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Où la fiche sort dans Google Maps autour de l&apos;adresse —
            scan automatique une fois par mois.
          </p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-xs"
            onClick={() => {
              setDraft(keywords.join(", "));
              setEditing(true);
            }}
          >
            Modifier les mots-clés
          </Button>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gg-keywords">
            Mots-clés suivis{" "}
            <span className="font-normal text-muted-foreground">
              (max {GEOGRID_MAX_KEYWORDS}, séparés par une virgule)
            </span>
          </Label>
          <div className="flex max-w-lg items-center gap-2">
            <Input
              id="gg-keywords"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                suggestion
                  ? `${suggestion.toLowerCase()}, ${suggestion.toLowerCase()} près de moi`
                  : "couvreur sainte-thérèse, toiture rive-nord"
              }
            />
            <Button
              size="sm"
              className="shrink-0"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Les mots que ses clients tapent vraiment (« couvreur », «
            toiture ») — le scan mesure la position dans le classement
            Maps depuis 49 points autour de l&apos;adresse.
          </p>
        </div>
      )}

      {!editing && keywords.length > 0 && scans.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Premier scan au prochain passage du cron (quotidien) — la carte
          apparaîtra ici.
        </p>
      )}

      {scans.length > 0 && (
        <div className="flex flex-wrap gap-6">
          {scans.map((scan) => (
            <ScanGrid key={scan.id} scan={scan} />
          ))}
        </div>
      )}

      {scans.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <LegendChip className="bg-success/85" label="1-3" />
          <LegendChip className="bg-warning/75" label="4-10" />
          <LegendChip className="bg-destructive/70" label="11-20" />
          <LegendChip className="bg-muted" label="absent" />
          <span>
            Case encadrée = l&apos;adresse ·{" "}
            {scans[0].spacing_km.toLocaleString("fr-CA")} km entre les
            points
          </span>
        </div>
      )}
    </section>
  );
}

function LegendChip({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", className)} />
      {label}
    </span>
  );
}

function rankClass(rank: number | null): string {
  if (rank === null) return "bg-muted text-muted-foreground/50";
  if (rank <= 3) return "bg-success/85 text-primary-foreground";
  if (rank <= 10) return "bg-warning/75 text-background";
  return "bg-destructive/70 text-primary-foreground";
}

function ScanGrid({ scan }: { scan: GeogridScan }) {
  const size = scan.grid_size;
  const centerIndex = Math.floor((size * size) / 2);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">« {scan.keyword} »</span>
        {scan.provider === "mock" && (
          <Badge variant="secondary">simulation</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(scan.scanned_at).toLocaleDateString("fr-CA")}
        </span>
      </div>
      <div
        className="grid w-fit gap-1"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {scan.ranks.map((point, index) => (
          <span
            key={`${point.lat}:${point.lng}`}
            title={
              point.rank === null
                ? "Hors du top 20 à ce point"
                : `Position ${point.rank}`
            }
            className={cn(
              "flex size-8 items-center justify-center rounded text-xs font-medium tabular-nums",
              rankClass(point.rank),
              index === centerIndex && "ring-2 ring-foreground/50 ring-inset",
            )}
          >
            {point.rank ?? "–"}
          </span>
        ))}
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {scan.avg_rank !== null && <>moyenne {scan.avg_rank.toLocaleString("fr-CA")} · </>}
        {scan.best_rank !== null && <>meilleur {scan.best_rank} · </>}
        présent sur {scan.found_count}/{scan.ranks.length} points
      </p>
    </div>
  );
}
