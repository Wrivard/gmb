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
            toast.success(
              `Fiches resynchronisées — ${result.discovered ?? 0} découvertes, ${result.created ?? 0} nouvelles.`,
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
