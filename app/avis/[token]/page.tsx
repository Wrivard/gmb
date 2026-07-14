import { notFound } from "next/navigation";
import { getPublicDb } from "@/lib/supabase/public";
import { RequestReview } from "./request-review";

// Page PUBLIQUE « Demander un avis » — l'outil de terrain du contracteur
// (favori sur son téléphone / QR dans le camion). Pas de session : le
// token non devinable est la seule clé, la RPC ne rend que le kit.

export const metadata = { title: "Demander un avis" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReviewKitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const { data, error } = await getPublicDb().rpc("review_kit", { token });
  if (error) throw new Error(error.message);
  const kit = data?.[0];
  if (!kit) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <RequestReview
        businessName={kit.client_name}
        reviewLink={kit.review_link}
        messageTemplate={kit.message}
      />
      <p className="text-center text-xs text-muted-foreground/60">
        Propulsé par Küa Locale
      </p>
    </main>
  );
}
