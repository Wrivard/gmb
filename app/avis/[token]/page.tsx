import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicDb } from "@/lib/supabase/public";
import { RequestReview } from "./request-review";

// Page PUBLIQUE « Demander un avis » — l'outil de terrain du contracteur
// (favori sur son téléphone / QR dans le camion). Pas de session : le
// token non devinable est la seule clé, la RPC ne rend que le kit.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// cache() : un seul appel RPC par requête (generateMetadata + page).
const loadKit = cache(async (token: string) => {
  const { data, error } = await getPublicDb().rpc("review_kit", { token });
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const kit = UUID_RE.test(token)
    ? await loadKit(token).catch(() => null)
    : null;
  return {
    // Le titre devient le nom du raccourci quand le contracteur ajoute
    // la page à son écran d'accueil — le nom de SON entreprise.
    title: kit ? `Demander un avis — ${kit.client_name}` : "Demander un avis",
    // Page à token : jamais indexée.
    robots: { index: false, follow: false },
  };
}

export default async function ReviewKitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const kit = await loadKit(token);
  if (!kit) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <RequestReview
        businessName={kit.client_name}
        reviewLink={kit.review_link}
        messageTemplate={kit.message}
      />
      <div className="flex flex-col gap-1.5 text-center text-xs text-muted-foreground/60">
        <p>
          Astuce : ajoute cette page à ton écran d&apos;accueil — elle sera
          toujours à deux taps en fin de chantier.
        </p>
        <p>Propulsé par Küa Locale</p>
      </div>
    </main>
  );
}
