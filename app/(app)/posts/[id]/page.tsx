import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/env";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PostEditor } from "./post-editor";

export const metadata = { title: "Éditeur de post" };

export default async function PostEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!supabaseConfigured()) {
    return (
      <Alert>
        <AlertDescription>
          Supabase n&apos;est pas encore configuré — remplis les variables dans
          `.env.local` (voir PROGRESS.md).
        </AlertDescription>
      </Alert>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.

  const supabase = createAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, website, agency_id")
    .eq("id", post.client_id)
    .eq("agency_id", member.agency_id)
    .maybeSingle();
  if (!client) notFound();

  const imageUrl = post.image_path
    ? supabase.storage.from("post-images").getPublicUrl(post.image_path).data
        .publicUrl
    : null;

  return (
    <PostEditor
      post={{
        id: post.id,
        summary: post.summary,
        ctaType: post.cta_type,
        ctaUrl: post.cta_url,
        status: post.status,
        scheduledFor: post.scheduled_for,
        publishedAt: post.published_at,
        publishError: post.publish_error,
        imagePrompt: post.image_prompt,
        imageUrl,
      }}
      clientName={client.name}
      clientWebsite={client.website}
    />
  );
}
