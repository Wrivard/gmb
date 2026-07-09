"use client";

// Boundary d'erreur des pages de l'app : jamais l'écran anglais brut de
// Next. Une erreur de fetch se répare souvent avec un simple réessai.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-elevated px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </span>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Impossible de charger la page
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Une erreur est survenue en chargeant les données. Rien n&apos;est
          perdu — réessaie, ou reviens au tableau.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          Réessayer
        </Button>
        <Button size="sm" variant="outline" render={<Link href="/" />}>
          Retour à Aujourd&apos;hui
        </Button>
      </div>
    </div>
  );
}
