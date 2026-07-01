import { LayoutDashboard } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function DashboardPage() {
  return (
    <PagePlaceholder
      icon={LayoutDashboard}
      title="Dashboard Kanban"
      description="La vue d'ensemble de tous les clients — reviews à répondre, posts dus, approbations en attente."
      phase="Livré en phase 6"
    />
  );
}
