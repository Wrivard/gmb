import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de l'éditeur de post — formulaire + aperçu Google. */
export default function PostEditorLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="flex max-w-2xl flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-lg" />
          <div className="flex gap-4">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-14 w-52" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-7 w-40" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-96 w-full max-w-sm rounded-xl sm:w-96" />
        </div>
      </div>
    </div>
  );
}
