import "server-only";

// Rapport mensuel client — « voici ce qu'on a fait ce mois-ci ».
// L'app détient tous les artefacts (posts + images, réponses publiées,
// historique de note) ; ce loader les assemble pour UN mois donné.

import { getDb } from "@/lib/supabase/db";
import { torontoInstant } from "@/lib/due";

const MONTH_LABELS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export interface ReportPost {
  id: string;
  summary: string;
  publishedAt: string;
  imageUrl: string | null;
}

export interface ReportReply {
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  replyText: string;
  publishedAt: string;
}

export interface MonthlyReport {
  monthKey: string; // "2026-06"
  monthLabel: string; // "juin 2026"
  ratingStart: number | null;
  ratingEnd: number | null;
  reviewsReceived: number;
  posts: ReportPost[];
  replies: ReportReply[];
  coverage: { target: number; published: number } | null;
}

/** "2026-06" → bornes UTC du mois calendrier Toronto. */
export function monthWindow(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: torontoInstant(year, month, 1),
    end: torontoInstant(nextYear, nextMonth, 1),
    label: `${MONTH_LABELS_FR[month - 1]} ${year}`,
  };
}

function cumulativeAvg(
  reviews: Array<{ star_rating: number; review_created_at: string }>,
  before: Date,
): number | null {
  const upTo = reviews.filter((r) => new Date(r.review_created_at) < before);
  if (!upTo.length) return null;
  return (
    Math.round(
      (upTo.reduce((sum, r) => sum + r.star_rating, 0) / upTo.length) * 10,
    ) / 10
  );
}

export async function loadMonthlyReport(
  clientId: string,
  monthKey: string,
): Promise<MonthlyReport> {
  const supabase = await getDb();
  const { start, end, label } = monthWindow(monthKey);
  const monthDate = `${monthKey}-01`;

  const [
    { data: reviews },
    { data: posts },
    { data: replies },
    { data: coverage },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, star_rating, comment, reviewer_name, review_created_at")
      .eq("client_id", clientId),
    supabase
      .from("posts")
      .select("id, summary, published_at, image_path")
      .eq("client_id", clientId)
      .eq("status", "published")
      .gte("published_at", start.toISOString())
      .lt("published_at", end.toISOString())
      .order("published_at"),
    supabase
      .from("review_replies")
      .select("review_id, published_text, published_at")
      .gte("published_at", start.toISOString())
      .lt("published_at", end.toISOString()),
    supabase
      .from("client_month_coverage")
      .select("posts_target, posts_published")
      .eq("client_id", clientId)
      .eq("month", monthDate)
      .maybeSingle(),
  ]);

  const reviewById = new Map((reviews ?? []).map((r) => [r.id, r]));
  const reportReplies: ReportReply[] = (replies ?? [])
    .filter((reply) => reviewById.has(reply.review_id) && reply.published_text)
    .map((reply) => {
      const review = reviewById.get(reply.review_id)!;
      return {
        reviewerName: review.reviewer_name,
        starRating: review.star_rating,
        comment: review.comment,
        replyText: reply.published_text!,
        publishedAt: reply.published_at!,
      };
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  return {
    monthKey,
    monthLabel: label,
    ratingStart: cumulativeAvg(reviews ?? [], start),
    ratingEnd: cumulativeAvg(reviews ?? [], end),
    reviewsReceived: (reviews ?? []).filter(
      (r) =>
        new Date(r.review_created_at) >= start &&
        new Date(r.review_created_at) < end,
    ).length,
    posts: (posts ?? []).map((post) => ({
      id: post.id,
      summary: post.summary,
      publishedAt: post.published_at!,
      imageUrl: post.image_path
        ? supabase.storage.from("post-images").getPublicUrl(post.image_path)
            .data.publicUrl
        : null,
    })),
    replies: reportReplies,
    coverage: coverage
      ? { target: coverage.posts_target, published: coverage.posts_published }
      : null,
  };
}
