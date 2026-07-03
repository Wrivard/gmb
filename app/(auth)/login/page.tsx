import { Suspense } from "react";
import Link from "next/link";
import { supabaseConfigured } from "@/lib/env";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-elevated p-8">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Küa Locale
          </span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Réservé à l&apos;équipe Küa.
        </p>

        {supabaseConfigured() ? (
          <Suspense>
            <LoginForm />
          </Suspense>
        ) : (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertDescription>
                Supabase n&apos;est pas encore configuré — remplis
                `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
                dans `.env.local` (voir PROGRESS.md).
              </AlertDescription>
            </Alert>
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Explorer l&apos;app avec des données d&apos;exemple
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
