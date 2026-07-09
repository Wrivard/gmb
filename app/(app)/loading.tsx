import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton générique des pages de l'app (specs/09 : jamais de spinner plein écran). */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 border-b border-border pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24" />
        ))}
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-96" />
        <Skeleton className="ml-auto h-4 w-40" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, column) => (
          <div key={column} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 3 }).map((_, card) => (
              <Skeleton key={card} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
