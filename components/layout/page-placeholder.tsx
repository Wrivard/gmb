import type { LucideIcon } from "lucide-react";

export function PagePlaceholder({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-elevated/40 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-hover">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.6} />
      </span>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        {phase}
      </span>
    </div>
  );
}
