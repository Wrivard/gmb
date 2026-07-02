"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CtaType } from "@/lib/types/database";

const CTA_LABELS: Record<CtaType, string> = {
  LEARN_MORE: "En savoir plus",
  CALL: "Appeler",
  BOOK: "Réserver",
  ORDER: "Commander",
  SIGN_UP: "S'inscrire",
};

/**
 * Réplique fidèle d'une carte Local Post Google (specs/09) :
 * image 4:3, nom + avatar de la fiche, texte tronqué « Plus », bouton CTA.
 */
export function PostPreview({
  clientName,
  summary,
  imageUrl,
  ctaType,
  className,
}: {
  clientName: string;
  summary: string;
  imageUrl: string | null;
  ctaType: CtaType | null;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const truncated = summary.length > 220 && !expanded;

  return (
    <div
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-xl border border-border bg-white text-neutral-900 shadow-sm",
        className,
      )}
    >
      <div className="aspect-[4/3] w-full bg-neutral-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Storage externe, préviz simple
          <img
            src={imageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-neutral-400">
            <ImageIcon className="size-6" />
            <span className="text-xs">Image à ajouter</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold uppercase">
            {clientName.slice(0, 1)}
          </span>
          <span className="text-sm font-medium">{clientName}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {truncated ? `${summary.slice(0, 220).trimEnd()}…` : summary}
          {truncated && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="ml-1 font-medium text-blue-600"
            >
              Plus
            </button>
          )}
        </p>
        {ctaType && (
          <span className="mt-1 inline-flex w-fit rounded-full border border-blue-600 px-4 py-1.5 text-sm font-medium text-blue-600">
            {CTA_LABELS[ctaType]}
          </span>
        )}
      </div>
    </div>
  );
}
