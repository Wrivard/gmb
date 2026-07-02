import "server-only";

import { getDb } from "@/lib/supabase/db";
import type { Json } from "@/lib/types/database";

export async function logActivity(entry: {
  agencyId?: string | null;
  clientId?: string | null;
  actor: string; // email membre, 'system' ou 'ai'
  action: string;
  payload?: Json;
}): Promise<void> {
  const supabase = await getDb();
  const { error } = await supabase.from("activity_log").insert({
    agency_id: entry.agencyId ?? null,
    client_id: entry.clientId ?? null,
    actor: entry.actor,
    action: entry.action,
    payload: entry.payload ?? {},
  });
  if (error) {
    // Le log ne doit jamais faire échouer l'opération principale.
    console.error("activity_log insert failed:", error.message);
  }
}
