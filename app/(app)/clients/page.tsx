import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <PagePlaceholder
      icon={Users}
      title="Clients"
      description="Les fiches Google Business Profile découvertes via la connexion Google de l'agence."
      phase="Livré en phase 2"
    />
  );
}
