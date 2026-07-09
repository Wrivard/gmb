import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de la liste Projets — même silhouette que la vraie table. */
export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
