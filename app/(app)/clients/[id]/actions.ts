"use server";

import { revalidatePath } from "next/cache";
import {
  loadClientForMember,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import { logActivity } from "@/lib/activity";
import {
  isKnownOnboardingItem,
  onboardingProgress,
} from "@/lib/onboarding/steps";
import type { BrandProfile, OnboardingState } from "@/lib/types/database";

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
  return runAction("La mise à jour a échoué.", async () => {
    const { member, supabase, client } = await loadClientForMember(clientId);
    if (client.status === "disconnected") {
      return { ok: false, error: "Fiche déconnectée — resynchronise d'abord." };
    }

    // L'auto-publish publie sur Google sans validation humaine : le
    // levier le plus risqué de l'app est réservé aux admins.
    const autoChanged =
      input.autoPublishReplies !== client.auto_publish_replies ||
      input.autoPublishPosts !== client.auto_publish_posts;
    if (autoChanged && member.role !== "owner") {
      return {
        ok: false,
        error: "Seul un admin peut modifier l'auto-publication.",
      };
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
  });
}

/** Notes internes — visibles par l'équipe, JAMAIS envoyées à l'AI. */
export async function updateInternalNotesAction(
  clientId: string,
  notes: string,
): Promise<ActionResult> {
  return runAction("L'enregistrement des notes a échoué.", async () => {
    const { supabase } = await loadClientForMember(clientId);

    const { error } = await supabase
      .from("clients")
      .update({ internal_notes: notes.trim() || null })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  });
}

/**
 * Archive un projet (offboarding) : il sort des listes, du kanban et
 * des syncs, mais tout l'historique reste. Owner seulement.
 */
export async function archiveClientAction(
  clientId: string,
): Promise<ActionResult> {
  return runAction("L'archivage a échoué.", async () => {
    const { member, supabase, client } = await loadClientForMember(clientId);
    if (member.role !== "owner") {
      return { ok: false, error: "Seul un admin peut archiver un projet." };
    }
    if (client.status === "active") {
      return {
        ok: false,
        error: "Mets d'abord le projet en pause avant de l'archiver.",
      };
    }

    const { error } = await supabase
      .from("clients")
      .update({ status: "archived" })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    await logActivity({
      agencyId: member.agency_id,
      clientId,
      actor: member.email,
      action: "client_archived",
    });

    revalidatePath("/clients");
    revalidatePath("/");
    return { ok: true };
  });
}

/** Assigne (ou désassigne, memberId=null) un responsable au projet. */
export async function updateClientAssigneeAction(
  clientId: string,
  memberId: string | null,
): Promise<ActionResult> {
  return runAction("L'assignation a échoué.", async () => {
    const { member, supabase } = await loadClientForMember(clientId);

    // Le responsable doit appartenir à la même agence.
    if (memberId) {
      const { data: target } = await supabase
        .from("agency_members")
        .select("id")
        .eq("id", memberId)
        .eq("agency_id", member.agency_id)
        .maybeSingle();
      if (!target) {
        return { ok: false, error: "Membre introuvable dans l'agence." };
      }
    }

    const { error } = await supabase
      .from("clients")
      .update({ assignee_member_id: memberId })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    revalidatePath("/clients");
    revalidatePath("/");
    return { ok: true };
  });
}

/**
 * Coche/décoche un item de la checklist d'optimisation de la fiche.
 * À 100 % (première fois) : completed_at + trace « fiche optimisée ».
 */
export async function setOnboardingItemAction(
  clientId: string,
  itemKey: string,
  done: boolean,
): Promise<ActionResult> {
  return runAction("L'enregistrement a échoué.", async () => {
    if (!isKnownOnboardingItem(itemKey)) {
      return { ok: false, error: "Item de checklist inconnu." };
    }

    const { member, supabase, client } = await loadClientForMember(clientId);
    const state: OnboardingState = client.onboarding ?? {};
    const items = { ...(state.items ?? {}) };
    if (done) {
      items[itemKey] = {
        done: true,
        by: member.email,
        at: new Date().toISOString(),
      };
    } else {
      delete items[itemKey];
    }

    const progress = onboardingProgress({ items });
    const justCompleted = progress.complete && !state.completed_at;
    const next: OnboardingState = {
      ...state,
      items,
      // Décocher après coup ne retire pas le jalon historique.
      completed_at: justCompleted
        ? new Date().toISOString()
        : (state.completed_at ?? null),
    };

    const { error } = await supabase
      .from("clients")
      .update({ onboarding: next })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    if (justCompleted) {
      await logActivity({
        agencyId: member.agency_id,
        clientId,
        actor: member.email,
        action: "client_onboarded",
      });
    }

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    return { ok: true };
  });
}

export async function updateBrandProfileAction(
  clientId: string,
  profile: BrandProfile,
): Promise<ActionResult> {
  return runAction("La mise à jour a échoué.", async () => {
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
  });
}
