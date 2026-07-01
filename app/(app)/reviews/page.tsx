import { MessageSquare } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <PagePlaceholder
      icon={MessageSquare}
      title="Inbox Reviews"
      description="Toutes les reviews des clients avec un draft de réponse AI prêt à publier."
      phase="Livré en phase 4"
    />
  );
}
