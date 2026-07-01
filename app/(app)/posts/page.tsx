import { Megaphone } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata = { title: "Posts" };

export default function PostsPage() {
  return (
    <PagePlaceholder
      icon={Megaphone}
      title="Posts GBP"
      description="Queue et calendrier des publications mensuelles générées par l'AI."
      phase="Livré en phase 5"
    />
  );
}
