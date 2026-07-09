import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { frCA } from "date-fns/locale";

// Feed d'activité — une seule présentation pour la fiche projet (scope
// client, sans nom) et le tableau Aujourd'hui (scope agence, avec le
// projet cliquable). Le schéma activity_log paie déjà pour les deux.

export const ACTION_LABELS: Record<string, string> = {
  reply_published: "Réponse publiée",
  reply_auto_published: "Réponse auto-publiée",
  review_ignored: "Review ignorée",
  post_generated: "Post généré",
  post_approved: "Post approuvé",
  post_unapproved: "Approbation annulée",
  post_published: "Post publié",
  generation: "Génération AI",
  sync_completed: "Sync terminé",
  client_settings_updated: "Réglages modifiés",
  brand_profile_updated: "Profil de marque modifié",
  client_archived: "Projet archivé",
};

// Le feed agence ne montre que les événements qui racontent le travail
// (humain ou publication) — pas la plomberie (sync aux 30 min, comptage
// de tokens) qui noierait tout.
export const AGENCY_FEED_ACTIONS = [
  "reply_published",
  "reply_auto_published",
  "review_ignored",
  "post_generated",
  "post_approved",
  "post_published",
  "client_settings_updated",
  "brand_profile_updated",
];

export interface ActivityEntry {
  id: string;
  label: string;
  actor: string;
  at: string;
  /** Présent en scope agence : le projet concerné, cliquable. */
  client?: { id: string; name: string } | null;
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-elevated px-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {entry.label}
            {entry.client && (
              <>
                {" — "}
                <Link
                  href={`/clients/${entry.client.id}`}
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {entry.client.name}
                </Link>
              </>
            )}
            <span className="ml-2 text-xs text-muted-foreground">
              par {entry.actor}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.at), {
              addSuffix: true,
              locale: frCA,
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
