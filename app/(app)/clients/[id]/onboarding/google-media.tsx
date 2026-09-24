"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { GbpMediaItem } from "@/lib/gbp/types";
import { loadGbpMediaAction } from "../actions";

// Photos DÉJÀ sur la fiche Google.
//
// Le wizard n'affichait que les photos téléversées dans l'app : une
// fiche avec logo, couverture et galerie paraissait vide, et on
// redemandait au client des images déjà en ligne. On pointe vers les
// originaux de Google — rien n'est recopié chez nous.

const LABEL: Record<string, string> = {
  PROFILE: "Logo",
  COVER: "Couverture",
  ADDITIONAL: "Galerie",
  EXTERIOR: "Extérieur",
  INTERIOR: "Intérieur",
  TEAM: "Équipe",
  AT_WORK: "En action",
  PRODUCT: "Produits",
};

export function GoogleMediaGallery({ clientId }: { clientId: string }) {
  const [media, setMedia] = useState<GbpMediaItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, startLoad] = useTransition();
  const requested = useRef(false);

  const load = () =>
    startLoad(async () => {
      setFailed(false);
      const result = await loadGbpMediaAction(clientId);
      if (!result.ok) {
        setFailed(true);
        toast.error(result.error);
        return;
      }
      setMedia(result.media ?? []);
    });

  // Ce composant n'est monté que sur l'étape Photos : charger ici, c'est
  // charger quand l'équipe en a besoin, et jamais sur les autres étapes.
  // Le garde-fou évite le double appel du mode strict de React.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (media === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading
            ? "Lecture des photos de la fiche…"
            : "Photos de la fiche non chargées."}
        </p>
        {failed && (
          <Button variant="outline" size="sm" onClick={load}>
            <ImageIcon />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  if (!media.length) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Aucune photo sur la fiche Google. C&apos;est un vrai manque : la
        couverture est la première impression dans Maps.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">
        {media.length} photo{media.length > 1 ? "s" : ""} déjà sur la fiche
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {media.map((item) => (
          <a
            key={item.name}
            href={item.googleUrl}
            target="_blank"
            rel="noreferrer"
            className="group relative block aspect-square overflow-hidden rounded border"
            title={LABEL[item.category] ?? item.category}
          >
            <Image
              src={item.thumbnailUrl ?? item.googleUrl}
              alt={LABEL[item.category] ?? "Photo de la fiche"}
              fill
              sizes="120px"
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] text-white">
              {LABEL[item.category] ?? item.category}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
