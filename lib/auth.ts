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
 * Le trigger DB lie user_id au signup; on matche aussi par email
 * au cas où la ligne whitelist a été ajoutée après le premier login.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, member: null };

  const { data: member } = await supabase
    .from("agency_members")
    .select("*")
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  return { user, member: member ?? null };
});
