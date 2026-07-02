"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import type { BrandProfile } from "@/lib/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

async function loadClientForMember(clientId: string) {
  const { member } = await getSessionContext();
  if (!member) throw new Error("Non autorisé.");

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (!client) throw new Error("Client introuvable.");

  return { member, supabase, client };
}

export async function updateClientSettingsAction(
  clientId: string,
  input: {
    postsPerMonth: number;
    language: string;
    autoPublishReplies: boolean;
    autoPublishPosts: boolean;
    active: boolean;
  },
): Promise<ActionResult> {
  try {
    const { member, supabase, client } = await loadClientForMember(clientId);
    if (client.status === "disconnected") {
      return { ok: false, error: "Fiche déconnectée — resynchronise d'abord." };
    }

    const { error } = await supabase
      .from("clients")
      .update({
        posts_per_month: Math.max(0, Math.min(10, Math.round(input.postsPerMonth))),
        language: input.language,
        auto_publish_replies: input.autoPublishReplies,
        auto_publish_posts: input.autoPublishPosts,
        status: input.active ? "active" : "paused",
      })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    await logActivity({
      agencyId: member.agency_id,
      clientId,
      actor: member.email,
      action: "client_settings_updated",
      payload: input,
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La mise à jour a échoué.",
    };
  }
}

export async function updateBrandProfileAction(
  clientId: string,
  profile: BrandProfile,
): Promise<ActionResult> {
  try {
    const { member, supabase } = await loadClientForMember(clientId);

    const { error } = await supabase
      .from("clients")
      .update({ brand_profile: profile })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    await logActivity({
      agencyId: member.agency_id,
      clientId,
      actor: member.email,
      action: "brand_profile_updated",
    });

    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La mise à jour a échoué.",
    };
  }
}
