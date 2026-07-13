import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { EmptyState } from "@/components/ui/empty-state";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "Nouveau projet" };

export default async function NewClientPage() {
  if (!supabaseConfigured()) {
    return (
      <EmptyState
        title="Mode exemple"
        hint="La création de projet s'utilise avec Supabase connecté."
      />
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  return <NewClientForm />;
}
