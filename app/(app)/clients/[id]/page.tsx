import { Users } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata = { title: "Fiche client" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      icon={Users}
      title={`Fiche client ${id}`}
      description="Aperçu, reviews, posts et réglages du client."
      phase="Livré en phase 6"
    />
  );
}
