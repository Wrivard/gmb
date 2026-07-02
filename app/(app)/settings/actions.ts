"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireMember() {
  const { member } = await getSessionContext();
  if (!member) throw new Error("Non autorisé.");
  return member;
}

export async function resyncClientsAction(): Promise<
  ActionResult & { created?: number; discovered?: number }
> {
  try {
    const member = await requireMember();
    const result = await runDiscovery(member.agency_id, member.email);
    revalidatePath("/settings");
    revalidatePath("/clients");
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "La resynchronisation a échoué.",
    };
  }
}

export async function toggleClientActiveAction(
  clientId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("clients")
      .update({ status: active ? "active" : "paused" })
      .eq("id", clientId)
      .eq("agency_id", member.agency_id)
      .neq("status", "disconnected");
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Échec de la mise à jour.",
    };
  }
}

export async function addMemberAction(
  email: string,
  role: "owner" | "member",
): Promise<ActionResult> {
  try {
    const member = await requireMember();
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut gérer l'équipe." };
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      return { ok: false, error: "Courriel invalide." };
    }
    const supabase = createAdminClient();
    const { error } = await supabase.from("agency_members").insert({
      agency_id: member.agency_id,
      email: trimmed,
      role,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ce courriel est déjà dans l'équipe." };
      }
      throw new Error(error.message);
    }
    await logActivity({
      agencyId: member.agency_id,
      actor: member.email,
      action: "member_added",
      payload: { email: trimmed, role },
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Échec de l'ajout.",
    };
  }
}

export async function removeMemberAction(
  memberId: string,
): Promise<ActionResult> {
  try {
    const member = await requireMember();
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut gérer l'équipe." };
    }
    if (member.id === memberId) {
      return { ok: false, error: "Tu ne peux pas te retirer toi-même." };
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("agency_members")
      .delete()
      .eq("id", memberId)
      .eq("agency_id", member.agency_id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Échec du retrait.",
    };
  }
}

export async function updateAgencyDefaultsAction(input: {
  defaultPostsPerMonth: number;
  defaultLanguage: string;
}): Promise<ActionResult> {
  try {
    const member = await requireMember();
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut modifier les défauts." };
    }
    const posts = Math.max(0, Math.min(10, Math.round(input.defaultPostsPerMonth)));
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("agencies")
      .update({
        default_posts_per_month: posts,
        default_language: input.defaultLanguage,
      })
      .eq("id", member.agency_id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Échec de la mise à jour.",
    };
  }
}
