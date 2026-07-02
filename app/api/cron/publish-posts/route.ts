import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGbpClient } from "@/lib/gbp/client";
import { publishPost } from "@/lib/posts/publish";

// Cron publish-posts (specs/04) — aux 15 min via Vercel Cron.
// 1. Posts `scheduled` échus → publishPost (lock optimiste inclus).
// 2. Filet : réponses de reviews `approved` non publiées → putReviewReply.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const counters = { published: 0, failed: 0, repliesPublished: 0 };

  // --- Posts planifiés échus ---
  const { data: duePosts } = await supabase
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for");

  for (const post of duePosts ?? []) {
    const result = await publishPost(post.id, ["scheduled"], "system");
    if (result.ok) counters.published++;
    else if (!result.locked) counters.failed++;
  }

  // --- Filet : réponses approuvées jamais parties ---
  const gbp = getGbpClient();
  const { data: approvedReviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("status", "approved");

  for (const review of approvedReviews ?? []) {
    const { data: reply } = await supabase
      .from("review_replies")
      .select("draft_text, published_at")
      .eq("review_id", review.id)
      .maybeSingle();
    if (!reply || reply.published_at) continue;

    try {
      await gbp.putReviewReply(review.gbp_review_name, reply.draft_text);
      await supabase
        .from("review_replies")
        .update({
          published_text: reply.draft_text,
          published_at: new Date().toISOString(),
          publish_error: null,
        })
        .eq("review_id", review.id);
      await supabase
        .from("reviews")
        .update({ status: "replied" })
        .eq("id", review.id);
      counters.repliesPublished++;
    } catch (error) {
      await supabase
        .from("review_replies")
        .update({
          publish_error:
            error instanceof Error ? error.message : "publication échouée",
        })
        .eq("review_id", review.id);
    }
  }

  return NextResponse.json({ ok: true, ...counters });
}
