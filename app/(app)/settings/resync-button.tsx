"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resyncClientsAction } from "./actions";

export function ResyncButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resyncClientsAction();
          if (result.ok) {
            // La resynchro ne crée plus de projet : l'import se fait
            // depuis la carte « Fiches Google ».
            const disconnected = result.disconnected ?? 0;
            toast.success(
              `${result.discovered ?? 0} fiches chez Google — ${result.refreshed ?? 0} projet${(result.refreshed ?? 0) > 1 ? "s" : ""} mis à jour.`,
              disconnected > 0
                ? {
                    description: `${disconnected} fiche${disconnected > 1 ? "s" : ""} n'est plus accessible — projet passé en « déconnecté ».`,
                  }
                : undefined,
            );
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      Resynchroniser les fiches
    </Button>
  );
}
