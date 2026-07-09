import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// L'état vide canonique de l'app — un seul langage au lieu de trois
// (boîte élevée riche / encadré pointillé / paragraphe nu).
// `md` : zone principale (files, listes). `sm` : encart secondaire
// (colonne kanban, calendrier, activité).
export function EmptyState({
  icon: Icon,
  title,
  hint,
  size = "md",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: React.ReactNode;
  size?: "md" | "sm";
  className?: string;
}) {
  if (size === "sm") {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border px-4 py-6 text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{title}</p>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-border bg-elevated px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </span>
      )}
      <p className="text-base font-medium">{title}</p>
      {hint && (
        <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
