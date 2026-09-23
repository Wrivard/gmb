// Accès centralisé aux variables d'environnement.
// `supabaseConfigured` permet un mode dégradé lisible tant que
// le projet Supabase n'est pas branché (voir PROGRESS.md).

import { gbpMode } from "@/lib/gbp/mode";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  gbpMode: gbpMode(),
};

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
