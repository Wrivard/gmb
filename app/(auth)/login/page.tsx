export const metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-elevated p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Küa Locale
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L&apos;authentification arrive en phase 1 (Supabase Auth — Google +
          courriel).
        </p>
      </div>
    </div>
  );
}
