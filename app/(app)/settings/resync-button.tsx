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
            const created = result.created ?? 0;
            toast.success(
              created > 0
                ? `${result.discovered ?? 0} fiches trouvées — ${created} nouvelle${created > 1 ? "s" : ""} en pause : active celles sous mandat dans Projets.`
                : `Fiches resynchronisées — ${result.discovered ?? 0} trouvées, aucune nouvelle.`,
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
