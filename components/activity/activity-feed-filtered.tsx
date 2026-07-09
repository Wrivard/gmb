"use client";

// Enrobage client du feed : filtre par acteur (« qu'a fait Marie cette
// semaine ») sur les entrées déjà chargées côté serveur.

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ActivityFeed,
  type ActivityEntry,
} from "@/components/activity/activity-feed";

export function ActivityFeedFiltered({
  entries,
}: {
  entries: ActivityEntry[];
}) {
  const [actor, setActor] = useState<string>("all");

  const actors = useMemo(
    () => [...new Set(entries.map((entry) => entry.actor))].sort(),
    [entries],
  );
  const visible =
    actor === "all"
      ? entries
      : entries.filter((entry) => entry.actor === actor);

  return (
    <div className="flex flex-col gap-2">
      {actors.length > 1 && (
        <div className="self-end">
          <Select value={actor} onValueChange={(v) => setActor(v as string)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l&apos;équipe</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {visible.length ? (
        <ActivityFeed entries={visible} />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Aucune activité de {actor} dans les derniers événements.
        </p>
      )}
    </div>
  );
}
