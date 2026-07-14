"use server";

import { revalidatePath } from "next/cache";
import {
  loadClientForMember,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import { logActivity } from "@/lib/activity";
import { isBrandProfileIncomplete } from "@/lib/clients/brand-profile";
import { getGbpClient } from "@/lib/gbp/client";
import { GbpAccessPendingError } from "@/lib/gbp/types";
import {
  isKnownOnboardingItem,
  onboardingCtx,
  onboardingProgress,
  PUSHABLE_SECTIONS,
  WEEKDAYS,
  type PushSection,
} from "@/lib/onboarding/steps";
import type {
  BrandProfile,
  GbpProfileData,
  OnboardingState,
} from "@/lib/types/database";

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

type ClientRow = Awaited<
  ReturnType<typeof loadClientForMember>
>["client"];

/** Jalon 100 % : stampe completed_at + trace, une seule fois. */
async function stampIfComplete(
  supabase: Awaited<ReturnType<typeof loadClientForMember>>["supabase"],
  member: { agency_id: string; email: string },
  client: ClientRow,
  nextProfile: GbpProfileData,
  nextOnboarding: OnboardingState,
): Promise<OnboardingState> {
  if (nextOnboarding.completed_at) return nextOnboarding;
  const progress = onboardingProgress(
    onboardingCtx({
      gbp_profile: nextProfile,
      onboarding: nextOnboarding,
      brandProfileComplete: !isBrandProfileIncomplete(client.brand_profile),
    }),
  );
  if (!progress.complete) return nextOnboarding;

  await logActivity({
    agencyId: member.agency_id,
    clientId: client.id,
    actor: member.email,
    action: "client_onboarded",
  });
  return { ...nextOnboarding, completed_at: new Date().toISOString() };
}

/** Coche/décoche un critère MANUEL de la checklist d'optimisation. */
export async function setOnboardingItemAction(
  clientId: string,
  itemKey: string,
  done: boolean,
): Promise<ActionResult> {
  return runAction("L'enregistrement a échoué.", async () => {
    if (!isKnownOnboardingItem(itemKey)) {
      return { ok: false, error: "Critère de checklist inconnu." };
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

    const next = await stampIfComplete(
      supabase,
      member,
      client,
      client.gbp_profile ?? {},
      { ...state, items },
    );

    const { error } = await supabase
      .from("clients")
      .update({ onboarding: next })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    return { ok: true };
  });
}

/** Sections de gbp_profile touchées par un patch (pour l'état dirty). */
function touchedSections(patch: Partial<GbpProfileData>): string[] {
  const sections = new Set<string>();
  if ("categories" in patch) sections.add("categories");
  if ("identity" in patch) sections.add("identity");
  if ("hours" in patch) sections.add("hours");
  if ("description" in patch || "opening_date" in patch)
    sections.add("presentation");
  if ("services" in patch) sections.add("services");
  if ("qna" in patch) sections.add("qna");
  return [...sections];
}

/**
 * Enregistre une ou plusieurs sections de la fiche (saisie du wizard).
 * Une section déjà poussée qui change repasse « à pousser » (dirty).
 */
export async function saveGbpProfileAction(
  clientId: string,
  patch: Partial<Omit<GbpProfileData, "sync">>,
): Promise<ActionResult> {
  return runAction("L'enregistrement a échoué.", async () => {
    const { member, supabase, client } = await loadClientForMember(clientId);
    const current: GbpProfileData = client.gbp_profile ?? {};

    const sync = { ...(current.sync ?? {}) };
    for (const section of touchedSections(patch)) {
      if (sync[section]) sync[section] = { ...sync[section], dirty: true };
    }

    const nextProfile: GbpProfileData = { ...current, ...patch, sync };
    const nextOnboarding = await stampIfComplete(
      supabase,
      member,
      client,
      nextProfile,
      client.onboarding ?? {},
    );

    const { error } = await supabase
      .from("clients")
      .update({ gbp_profile: nextProfile, onboarding: nextOnboarding })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    return { ok: true };
  });
}

const GOOGLE_WEEKDAY: Record<string, string> = {
  monday: "MONDAY",
  tuesday: "TUESDAY",
  wednesday: "WEDNESDAY",
  thursday: "THURSDAY",
  friday: "FRIDAY",
  saturday: "SATURDAY",
  sunday: "SUNDAY",
};

function timeOfDay(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/** Patch Business Information + updateMask pour une section pushable. */
function buildLocationPatch(
  section: PushSection,
  profile: GbpProfileData,
): { patch: Record<string, unknown>; mask: string } | { error: string } {
  switch (section) {
    case "identity": {
      const identity = profile.identity ?? {};
      if (!identity.name?.trim()) {
        return { error: "Renseigne au moins le nom avant de pousser." };
      }
      // L'adresse est volontairement exclue : la modifier via API peut
      // déclencher une re-vérification de la fiche — trop risqué en lot.
      return {
        patch: {
          title: identity.name.trim(),
          ...(identity.phone?.trim()
            ? { phoneNumbers: { primaryPhone: identity.phone.trim() } }
            : {}),
          ...(identity.website?.trim()
            ? { websiteUri: identity.website.trim() }
            : {}),
        },
        mask: [
          "title",
          ...(identity.phone?.trim() ? ["phoneNumbers.primaryPhone"] : []),
          ...(identity.website?.trim() ? ["websiteUri"] : []),
        ].join(","),
      };
    }
    case "hours": {
      const hours = profile.hours ?? {};
      const defined = WEEKDAYS.filter((d) => hours[d.key] !== undefined);
      if (!defined.length) {
        return { error: "Définis les heures avant de pousser." };
      }
      const periods = WEEKDAYS.flatMap((day) => {
        const value = hours[day.key];
        if (!value) return [];
        return [
          {
            openDay: GOOGLE_WEEKDAY[day.key],
            openTime: timeOfDay(value.open),
            closeDay: GOOGLE_WEEKDAY[day.key],
            closeTime: timeOfDay(value.close),
          },
        ];
      });
      return { patch: { regularHours: { periods } }, mask: "regularHours" };
    }
    case "presentation": {
      if (!profile.description?.trim() && !profile.opening_date) {
        return { error: "Rien à pousser — remplis la description d'abord." };
      }
      const [year, month] = (profile.opening_date ?? "").split("-").map(Number);
      return {
        patch: {
          ...(profile.description?.trim()
            ? { profile: { description: profile.description.trim() } }
            : {}),
          ...(year ? { openInfo: { openingDate: { year, month } } } : {}),
        },
        mask: [
          ...(profile.description?.trim() ? ["profile.description"] : []),
          ...(year ? ["openInfo.openingDate"] : []),
        ].join(","),
      };
    }
    case "services": {
      const services = (profile.services ?? []).filter((s) => s.name?.trim());
      if (!services.length) {
        return { error: "Ajoute au moins un service avant de pousser." };
      }
      return {
        patch: {
          serviceItems: services.map((service) => ({
            freeFormServiceItem: {
              label: {
                displayName: service.name.trim(),
                ...(service.description?.trim()
                  ? { description: service.description.trim() }
                  : {}),
              },
            },
          })),
        },
        mask: "serviceItems",
      };
    }
  }
}

/**
 * Pousse une section de la fiche vers Google (locations.patch via
 * GbpClient — mock tant que l'accès API n'est pas approuvé).
 */
export async function pushGbpSectionAction(
  clientId: string,
  section: PushSection,
): Promise<ActionResult> {
  return runAction("Le push vers Google a échoué.", async () => {
    if (!PUSHABLE_SECTIONS.includes(section)) {
      return { ok: false, error: "Section inconnue." };
    }

    const { member, supabase, client } = await loadClientForMember(clientId);
    if (!client.gbp_location_id) {
      return {
        ok: false,
        error:
          "Aucune fiche Google liée à ce projet — connecte le compte Google d'abord (les données restent enregistrées ici).",
      };
    }

    const profile: GbpProfileData = client.gbp_profile ?? {};
    const built = buildLocationPatch(section, profile);
    if ("error" in built) return { ok: false, error: built.error };

    try {
      await getGbpClient().updateLocation(
        client.gbp_location_id,
        built.patch,
        built.mask,
      );
    } catch (error) {
      if (error instanceof GbpAccessPendingError) {
        return {
          ok: false,
          error:
            "Accès API Google en attente d'approbation — les données sont enregistrées, le push se fera dès l'approbation.",
        };
      }
      throw error;
    }

    const sync = {
      ...(profile.sync ?? {}),
      [section]: { pushed_at: new Date().toISOString(), by: member.email },
    };
    const { error } = await supabase
      .from("clients")
      .update({ gbp_profile: { ...profile, sync } })
      .eq("id", clientId);
    if (error) throw new Error(error.message);

    await logActivity({
      agencyId: member.agency_id,
      clientId,
      actor: member.email,
      action: "gbp_pushed",
      payload: { section },
    });

    revalidatePath(`/clients/${clientId}`);
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
