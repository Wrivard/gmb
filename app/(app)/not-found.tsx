import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 404 dans le shell de l'app — post ou projet supprimé, URL erronée. */
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-elevated px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" />
      </span>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Page introuvable
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Ce contenu n&apos;existe pas ou a été supprimé.
        </p>
      </div>
      <Button size="sm" variant="outline" render={<Link href="/" />}>
        Retour à Aujourd&apos;hui
      </Button>
    </div>
  );
}
