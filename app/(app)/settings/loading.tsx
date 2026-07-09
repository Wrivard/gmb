import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de la page Agence — pile de cartes comme la vraie page. */
export default function SettingsLoading() {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-96" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-lg" />
      ))}
    </div>
  );
}
