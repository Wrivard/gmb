import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata = { title: "Réglages" };

export default function SettingsPage() {
  return (
    <PagePlaceholder
      icon={Settings}
      title="Réglages"
      description="Connexion Google de l'agence, équipe et paramètres par défaut."
      phase="Livré en phase 2"
    />
  );
}
