"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleClientActiveAction } from "./actions";

export function ClientActiveToggle({
  clientId,
  active,
  disabled,
  /** Fiche pas 100 % optimisée : activer déclenche l'invitation au wizard
      — LE moment où l'optimisation initiale se joue. */
  onboardingIncomplete = false,
}: {
  clientId: string;
  active: boolean;
  disabled?: boolean;
  onboardingIncomplete?: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(active);
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={checked}
      disabled={disabled || pending}
      aria-label="Projet actif"
      onCheckedChange={(next) => {
        setChecked(next);
        startTransition(async () => {
          const result = await toggleClientActiveAction(clientId, next);
          if (!result.ok) {
            setChecked(!next);
            toast.error(result.error);
            return;
          }
          if (next && onboardingIncomplete) {
            toast.warning("Mandat activé — la fiche n'est pas optimisée.", {
              description:
                "L'optimisation initiale est ce qui fait ranker : fais la checklist maintenant.",
              action: {
                label: "Optimiser",
                onClick: () => router.push(`/clients/${clientId}/onboarding`),
              },
              duration: 8000,
            });
          } else {
            toast.success(next ? "Projet réactivé." : "Projet mis en pause.");
          }
        });
      }}
    />
  );
}
