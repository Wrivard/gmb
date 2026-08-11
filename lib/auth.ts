import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AgencyMember } from "@/lib/types/database";
import type { User } from "@supabase/supabase-js";

export interface SessionContext {
  user: User | null;
  /** Ligne whitelist correspondante — null si l'email n'est pas autorisé. */
  member: AgencyMember | null;
}

/**
 * Session + whitelist en un appel (mis en cache par render).
 *
 * L'appartenance passe par `current_member()` (SECURITY DEFINER) et non
 * par une requête directe sur agency_members : la RLS de cette table
 * s'appuie sur user_agency_ids(), qui lit agency_members filtrée par
 * user_id. Une ligne dont le lien manque est donc invisible à son
 * propre propriétaire — un repli par courriel côté client ne pouvait
 * jamais matcher. La fonction sort de cette circularité et répare le
 * lien au passage (voir migration 20260811000017).
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, member: null };

  const { data: member } = await supabase.rpc("current_member").maybeSingle();

  return { user, member: member ?? null };
});
