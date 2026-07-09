import "server-only";

// Loaders partagés layout ↔ pages, mémoïsés par requête avec React
// cache() : le layout et la page du même rendu ne paient qu'une seule
// requête board/connexion/clients au lieu de la dupliquer.

import { cache } from "react";
import { getDb } from "@/lib/supabase/db";

/** Board kanban : une ligne par client actif, compteurs agrégés. */
export const getBoardState = cache(async (agencyId: string) => {
  const supabase = await getDb();
  return supabase
    .from("client_board_state")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("status", "active")
    .order("name");
});

/** Statut de la connexion Google de l'agence. */
export const getGoogleConnectionStatus = cache(async (agencyId: string) => {
  const supabase = await getDb();
  return supabase
    .from("google_connections")
    .select("status")
    .eq("agency_id", agencyId)
    .maybeSingle();
});

/** Index léger des clients de l'agence (palette, méta des cartes). */
export const getClientsIndex = cache(async (agencyId: string) => {
  const supabase = await getDb();
  return supabase
    .from("clients")
    .select("id, name, primary_category, address, last_synced_at, status")
    .eq("agency_id", agencyId)
    .order("name");
});
