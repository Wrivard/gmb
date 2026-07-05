import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Client « compte de service » : un vrai compte auth (membre de l'agence)
// signé in par mot de passe, dont les requêtes portent un JWT membre —
// la RLS (policies `_member_all`) l'autorise à tout ce que font les crons.
// Alternative à la clé service_role quand elle n'est pas disponible
// (voir décision #15 / #16 dans PROGRESS.md). Réservé au code serveur
// sans session (crons). NE JAMAIS importer côté client.

type ServiceClient = ReturnType<typeof createSupabaseClient<Database>>;

let cached: { client: ServiceClient; expiresAt: number } | null = null;

export function serviceAccountConfigured(): boolean {
  return Boolean(
    process.env.CRON_SERVICE_EMAIL && process.env.CRON_SERVICE_PASSWORD,
  );
}

// Client signé in, mis en cache jusqu'à ~2 min avant l'expiry du JWT et
// partagé entre tous les appels d'une même invocation (et les invocations
// « warm »). Un seul signInWithPassword par cycle de token.
export async function getServiceClient(): Promise<ServiceClient> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 120 > now) {
    return cached.client;
  }

  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.CRON_SERVICE_EMAIL!,
    password: process.env.CRON_SERVICE_PASSWORD!,
  });
  if (error || !data.session) {
    throw new Error(
      `Connexion du compte de service échouée : ${error?.message ?? "session absente"}`,
    );
  }

  cached = { client, expiresAt: data.session.expires_at ?? now + 3600 };
  return client;
}
