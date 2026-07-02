"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleClientActiveAction } from "./actions";

export function ClientActiveToggle({
  clientId,
  active,
  disabled,
}: {
  clientId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(active);
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={checked}
      disabled={disabled}
      aria-label="Client actif"
      onCheckedChange={(next) => {
        setChecked(next);
        startTransition(async () => {
          const result = await toggleClientActiveAction(clientId, next);
          if (!result.ok) {
            setChecked(!next);
            toast.error(result.error);
          }
        });
      }}
    />
  );
}
