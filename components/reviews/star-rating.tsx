import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Étoiles dorées 1–5 (specs/09 §Composants clés). */
export function StarRating({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value} étoiles sur 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            size === "sm" ? "size-3" : "size-3.5",
            i <= value
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted",
          )}
        />
      ))}
    </span>
  );
}
