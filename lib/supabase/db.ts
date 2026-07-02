import "server-only";

import { createAdminClient } from "./admin";
import { createClient } from "./server";

/**
 * Client DB pour le code exécuté dans une requête (pages, actions,
 * routes OAuth). Service role si disponible; sinon client de session —
 * la RLS (policies membres) couvre toutes les opérations de l'app.
 * Permet de travailler en local sans SUPABASE_SERVICE_ROLE_KEY.
 * Les crons, eux, exigent le service role (pas de session) et
 * importent createAdminClient directement.
 */
export async function getDb() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createAdminClient();
  }
  return createClient();
}
