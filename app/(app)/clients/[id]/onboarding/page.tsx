import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { isBrandProfileIncomplete } from "@/lib/clients/brand-profile";
import { EmptyState } from "@/components/ui/empty-state";
import { OnboardingWizard } from "./onboarding-wizard";

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
    .select("id, name, status, onboarding, gbp_profile, brand_profile")
    .eq("id", id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) notFound();

  // Fiche pas encore saisie ? Pré-remplir l'identité depuis ce que la
  // découverte Google (ou la création manuelle) connaît déjà — on ne
  // fait jamais retaper ce que l'app sait.
  const profile = client.gbp_profile ?? {};
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
    <OnboardingWizard
      clientId={client.id}
      clientName={client.name}
      clientStatus={client.status}
      initialProfile={profile}
      initialChecks={client.onboarding?.items ?? {}}
      brandProfileComplete={!isBrandProfileIncomplete(client.brand_profile)}
    />
  );
}
