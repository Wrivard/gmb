import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { isBrandProfileIncomplete } from "@/lib/clients/brand-profile";
import { EmptyState } from "@/components/ui/empty-state";
import { OnboardingWizard } from "./onboarding-wizard";
import { getGbpClient } from "@/lib/gbp/client";
import { locationToProfile, mergeProfile } from "@/lib/gbp/profile-import";

export const metadata = { title: "Optimisation de la fiche" };

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!supabaseConfigured()) {
    return (
      <EmptyState
        title="Mode exemple"
        hint="Le wizard d'optimisation s'utilise avec un vrai projet — connecte Supabase."
      />
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = await getDb();
  const { data: client, error } = await supabase
    .from("clients")
    .select(
      "id, name, status, onboarding, gbp_profile, brand_profile, gbp_account_id, gbp_location_id",
    )
    .eq("id", id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) notFound();

  // Première ouverture : lire la fiche. Ensuite, à la demande.
  //
  // Le wizard doit montrer l'état réel de la fiche, sinon « ce qui
  // manque » ne veut rien dire. Mais relire à chaque ouverture coûtait
  // un appel pour rien : la fiche d'un client ne bouge pas entre deux
  // visites du même écran. Le bouton de l'en-tête couvre le reste.
  //
  // La fusion ne réécrit jamais une saisie locale : ce qui a été
  // travaillé ici mais pas encore poussé reste intact.
  let profile = client.gbp_profile ?? {};
  let syncedAt: string | null = profile.synced_at ?? null;
  if (client.gbp_location_id && !profile.synced_at) {
    try {
      const location = await getGbpClient().getLocation(
        client.gbp_account_id ?? client.gbp_location_id,
        client.gbp_location_id,
      );
      syncedAt = new Date().toISOString();
      profile = {
        ...mergeProfile(profile, locationToProfile(location)),
        synced_at: syncedAt,
      };
      await supabase
        .from("clients")
        .update({ gbp_profile: profile })
        .eq("id", id);
    } catch (error) {
      // Google injoignable : on continue avec la dernière copie connue.
      // Un wizard qui refuse de s'ouvrir parce qu'un tiers est en panne
      // serait pire que des données d'hier.
      console.error(`relecture de la fiche ${client.name}:`, error);
    }
  }

  if (!profile.identity) {
    const { data: base } = await supabase
      .from("clients")
      .select("name, address, phone, website, primary_category")
      .eq("id", id)
      .single();
    profile.identity = {
      name: base?.name ?? client.name,
      address: base?.address ?? undefined,
      phone: base?.phone ?? undefined,
      website: base?.website ?? undefined,
    };
    if (!profile.categories?.primary && base?.primary_category) {
      profile.categories = {
        ...(profile.categories ?? {}),
        primary: base.primary_category,
      };
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <OnboardingWizard
        clientId={client.id}
        clientName={client.name}
        clientStatus={client.status}
        initialProfile={profile}
        initialChecks={client.onboarding?.items ?? {}}
        brandProfileComplete={!isBrandProfileIncomplete(client.brand_profile)}
        syncedAt={syncedAt}
      />
    </div>
  );
}
