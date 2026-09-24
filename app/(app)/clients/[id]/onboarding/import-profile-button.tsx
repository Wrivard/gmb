"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importGbpProfileAction } from "../actions";

/**
 * Recharge le profil depuis la fiche Google.
 *
 * Le wizard mesure `clients.gbp_profile`. Un projet importé avant le
 * préremplissage automatique a un profil vide : le score affichait 0 %
 * sur un commerce déjà optimisé, et demandait de ressaisir description,
 * horaires et catégories que Google connaissait déjà.
 */
export function ImportProfileButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await importGbpProfileAction(clientId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.refresh();
          toast.success("Profil rechargé depuis la fiche Google.", {
            description:
              "Ce que l'équipe avait déjà saisi ici a été conservé.",
          });
        })
      }
    >
      <DownloadCloud className={pending ? "animate-pulse" : undefined} />
      Importer depuis Google
    </Button>
  );
}
