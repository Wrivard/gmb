"use client";

// Bascule réel ↔ démo : le mode démo affiche les clients fictifs du
// seed (démonstrations, tests) sans toucher aux vraies données. Le
// choix vaut pour CE navigateur (cookie) — un collègue peut être en
// démo pendant que tu travailles en réel.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DataMode } from "@/lib/data-mode";
import { setDataModeAction } from "./actions";

export function DataModeCard({ mode }: { mode: DataMode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: DataMode) {
    if (next === mode) return;
    startTransition(async () => {
      const result = await setDataModeAction(next);
      if (result.ok) {
        toast.success(
          next === "demo"
            ? "Mode démo — clients fictifs affichés."
            : "Mode réel — retour aux vrais mandats.",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mode de données</CardTitle>
        <CardDescription>
          Réel = tes vrais mandats. Démo = les clients fictifs (Clinique
          Dentaire Sourire Plus, Électricité Dumont…) pour montrer l&apos;app
          ou tester sans exposer de vraies données. Le choix vaut pour ce
          navigateur seulement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Button
          size="sm"
          variant={mode === "real" ? "default" : "outline"}
          onClick={() => apply("real")}
          disabled={pending}
        >
          Réel
        </Button>
        <Button
          size="sm"
          variant={mode === "demo" ? "default" : "outline"}
          onClick={() => apply("demo")}
          disabled={pending}
        >
          Démo
        </Button>
      </CardContent>
    </Card>
  );
}
