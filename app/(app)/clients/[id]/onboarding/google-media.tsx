"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
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
  const [loading, startLoad] = useTransition();

  const load = () =>
    startLoad(async () => {
      const result = await loadGbpMediaAction(clientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMedia(result.media ?? []);
    });

  if (media === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
        <p className="text-sm text-muted-foreground">
          La fiche a peut-être déjà des photos en ligne — inutile de les
          redemander au client.
        </p>
        <Button variant="outline" size="sm" disabled={loading} onClick={load}>
          {loading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
          Voir les photos de la fiche
        </Button>
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
