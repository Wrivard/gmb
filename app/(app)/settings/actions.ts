"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  getMemberDb,
  requireMember,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import { DATA_MODE_COOKIE, type DataMode } from "@/lib/data-mode";
import { runDiscovery } from "@/lib/gbp/discovery";
import { logActivity } from "@/lib/activity";

/** Bascule réel ↔ démo (cookie par navigateur — voir lib/data-mode.ts). */
export async function setDataModeAction(mode: DataMode): Promise<ActionResult> {
  return runAction("Le changement de mode a échoué.", async () => {
    await requireMember();
    const store = await cookies();
    store.set(DATA_MODE_COOKIE, mode === "demo" ? "demo" : "real", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function resyncClientsAction(): Promise<
  ActionResult & { created?: number; discovered?: number }
> {
  return runAction("La resynchronisation a échoué.", async () => {
    const member = await requireMember();
    const result = await runDiscovery(member.agency_id, member.email);
    revalidatePath("/settings");
    revalidatePath("/clients");
    return { ok: true, ...result };
  });
}

export async function toggleClientActiveAction(
  clientId: string,
  active: boolean,
): Promise<ActionResult> {
  return runAction("Échec de la mise à jour.", async () => {
    const { member, supabase } = await getMemberDb();
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
  });
}

export async function addMemberAction(
  email: string,
  role: "owner" | "member",
): Promise<ActionResult> {
  return runAction("Échec de l'ajout.", async () => {
    const { member, supabase } = await getMemberDb();
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut gérer l'équipe." };
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      return { ok: false, error: "Courriel invalide." };
    }
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
  });
}

export async function removeMemberAction(
  memberId: string,
): Promise<ActionResult> {
  return runAction("Échec du retrait.", async () => {
    const { member, supabase } = await getMemberDb();
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut gérer l'équipe." };
    }
    if (member.id === memberId) {
      return { ok: false, error: "Tu ne peux pas te retirer toi-même." };
    }
    const { error } = await supabase
      .from("agency_members")
      .delete()
      .eq("id", memberId)
      .eq("agency_id", member.agency_id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return { ok: true };
  });
}

export async function updateAgencyDefaultsAction(input: {
  defaultPostsPerMonth: number;
  defaultLanguage: string;
}): Promise<ActionResult> {
  return runAction("Échec de la mise à jour.", async () => {
    const { member, supabase } = await getMemberDb();
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut modifier les défauts." };
    }
    const posts = Math.max(0, Math.min(10, Math.round(input.defaultPostsPerMonth)));
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
  });
}
