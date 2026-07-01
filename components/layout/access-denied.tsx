"use client";

import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AccessDenied({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/10">
        <ShieldX className="size-5 text-danger" />
      </span>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Accès non autorisé
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Le compte <span className="text-foreground">{email}</span> n&apos;est
          pas dans la liste de l&apos;équipe Küa. Demande à un admin de
          t&apos;ajouter dans Réglages → Équipe.
        </p>
      </div>
      <Button variant="outline" onClick={signOut}>
        Se déconnecter
      </Button>
    </div>
  );
}
