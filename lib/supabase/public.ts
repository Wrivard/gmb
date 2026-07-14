import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Client anonyme sans session — réservé aux pages PUBLIQUES qui ne
// lisent que des RPC bornées (review_kit). La RLS bloque tout le reste :
// aucune policy anon n'existe sur les tables.

export function getPublicDb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
