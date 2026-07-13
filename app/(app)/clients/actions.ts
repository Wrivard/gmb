"use server";

import { revalidatePath } from "next/cache";
import {
  getMemberDb,
  runAction,
  type ActionResult,
} from "@/lib/actions/member";
import { logActivity } from "@/lib/activity";
import type { BrandProfile } from "@/lib/types/database";

/**
 * Crée un projet à la main — le chemin « nouveau mandat signé » quand la
 * fiche Google n'est pas encore accessible (la découverte la liera au
 * premier sync). Le projet naît en pause : il s'active une fois la fiche
 * optimisée (wizard d'onboarding).
 */
export async function createClientAction(input: {
  name: string;
  category?: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
  postsPerMonth?: number;
}): Promise<ActionResult & { clientId?: string }> {
  return runAction("La création du projet a échoué.", async () => {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Le nom du projet est requis." };

    const { member, supabase } = await getMemberDb();

    const { data: agency } = await supabase
      .from("agencies")
      .select("default_posts_per_month, default_language")
      .eq("id", member.agency_id)
      .single();

    // Même préremplissage que la découverte Google : l'IA a besoin d'un
    // minimum de profil dès le premier brouillon.
    const brandProfile: BrandProfile = {
      tone: "chaleureux et professionnel",
      vertical: input.category?.trim().toLowerCase() || undefined,
      city: input.city?.trim() || undefined,
      signature: `L'équipe ${name}`,
      phone: input.phone?.trim() || undefined,
      a_eviter: ["prix précis"],
    };

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        agency_id: member.agency_id,
        name,
        primary_category: input.category?.trim() || null,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        website: input.website?.trim() || null,
        posts_per_month:
          input.postsPerMonth ?? agency?.default_posts_per_month ?? 2,
        language: agency?.default_language ?? "fr-CA",
        brand_profile: brandProfile,
        status: "paused",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logActivity({
      agencyId: member.agency_id,
      clientId: created.id,
      actor: member.email,
      action: "client_created",
      payload: { name },
    });

    revalidatePath("/clients");
    revalidatePath("/");
    return { ok: true, clientId: created.id };
  });
}
