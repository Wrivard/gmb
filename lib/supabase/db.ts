import "server-only";

import { createAdminClient } from "./admin";
import { createClient } from "./server";
import { getServiceClient, serviceAccountConfigured } from "./service";

/**
 * Client DB pour le code exécuté dans une requête (pages, actions,
 * routes OAuth, crons). Ordre de résolution :
 *   1. Service role si disponible (bypass RLS) ;
 *   2. sinon client de session cookie si un user est connecté
 *      (pages/actions) — la RLS membre couvre toutes les opérations ;
 *   3. sinon, en dernier recours, le compte de service (crons sans
 *      session) — mêmes droits qu'un membre via la RLS.
 *
 * Le cas 3 n'est atteignable qu'après vérification du CRON_SECRET
 * (les crons) : aucune route user-facing n'appelle getDb() sans
 * session valide, donc pas d'élévation de privilège anonyme.
 */
export async function getDb() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createAdminClient();
  }

  const sessionClient = await createClient();
  if (serviceAccountConfigured()) {
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user) {
      return getServiceClient();
    }
  }
  return sessionClient;
}
