import Link from "next/link";

/**
 * États d'erreur globaux (specs/02 + 04) : connexion Google révoquée
 * (rouge, partout) et accès API en attente d'approbation (informatif).
 */
export function GlobalBanners({
  connectionRevoked,
  accessPending,
}: {
  connectionRevoked: boolean;
  accessPending: boolean;
}) {
  if (!connectionRevoked && !accessPending) return null;

  return (
    <div className="flex flex-col">
      {connectionRevoked && (
        <div className="bg-destructive/15 px-6 py-2 text-center text-sm text-destructive">
          Connexion Google expirée — les publications sont suspendues.{" "}
          <Link href="/settings" className="font-medium underline">
            Reconnecter
          </Link>
        </div>
      )}
      {!connectionRevoked && accessPending && (
        <div className="bg-info/10 px-6 py-2 text-center text-sm text-info">
          Accès aux APIs Google Business Profile en attente d&apos;approbation
          (quota 0) — le sync reprendra automatiquement une fois le projet
          approuvé.
        </div>
      )}
    </div>
  );
}
