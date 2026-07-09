"use client";

// Cadence du mandat éditable inline depuis la liste Projets — « une
// compagnie demande 3 posts par mois, l'autre 2 » se règle ici, sans
// ouvrir la fiche. 0 = reviews seulement.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClientSettingsAction } from "./[id]/actions";

const CADENCES = [0, 1, 2, 3, 4, 5, 6] as const;

export function CadenceSelect({
  client,
  disabled,
}: {
  client: {
    id: string;
    posts_per_month: number;
    language: string;
    auto_publish_replies: boolean;
    auto_publish_posts: boolean;
    status: string;
  };
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(client.posts_per_month));
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      disabled={disabled || pending}
      onValueChange={(next) => {
        if (typeof next !== "string" || next === value) return;
        const previous = value;
        setValue(next);
        startTransition(async () => {
          const result = await updateClientSettingsAction(client.id, {
            postsPerMonth: Number(next),
            language: client.language,
            autoPublishReplies: client.auto_publish_replies,
            autoPublishPosts: client.auto_publish_posts,
            active: client.status === "active",
          });
          if (result.ok) {
            toast.success("Mandat mis à jour.");
            router.refresh();
          } else {
            setValue(previous);
            toast.error(result.error);
          }
        });
      }}
    >
      <SelectTrigger size="sm" className="w-fit min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CADENCES.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n === 0 ? "Reviews seulement" : `${n} post${n > 1 ? "s" : ""}/mois`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
