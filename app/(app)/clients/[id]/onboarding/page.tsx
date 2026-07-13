import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
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
    .select("id, name, status, onboarding")
    .eq("id", id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) notFound();

  return (
    <OnboardingWizard
      clientId={client.id}
      clientName={client.name}
      clientStatus={client.status}
      initialState={client.onboarding ?? {}}
    />
  );
}
