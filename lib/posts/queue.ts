import "server-only";

// Requêteur de la file de posts — possède la requête, la cadence,
// la construction d'URL Storage et les DTO QueueClient/QueuePost.
// Ce mapping était recopié entre posts/page.tsx et l'onglet Posts de
// la fiche client (URL publique post-images incluse).
// Sans Supabase configuré : adapter démo (fixtures lib/demo.ts) derrière
// la même interface.

import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { demoQueueClients, demoQueuePosts } from "@/lib/demo";
import { monthlyCadence, torontoMonthTester } from "@/lib/posts/cadence";
import type { Database, PostStatus } from "@/lib/types/database";

export interface QueueClient {
  id: string;
  name: string;
  remaining: number;
  late: boolean;
}

export interface QueuePost {
  id: string;
  clientId: string;
  clientName: string;
  summary: string;
  status: PostStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishError: string | null;
  imageUrl: string | null;
}

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type Db = Awaited<ReturnType<typeof getDb>>;

function toQueuePost(
  supabase: Db,
  post: PostRow,
  clientName: string,
): QueuePost {
  return {
    id: post.id,
    clientId: post.client_id,
    clientName,
    summary: post.summary,
    status: post.status,
    scheduledFor: post.scheduled_for,
    publishedAt: post.published_at,
    publishError: post.publish_error,
    imageUrl: post.image_path
      ? supabase.storage.from("post-images").getPublicUrl(post.image_path)
          .data.publicUrl
      : null,
  };
}

/**
 * File de l'agence (/posts) : clients actifs avec leur cadence, et
 * tout ce qui est actif + les publiés du mois courant.
 */
export async function loadAgencyQueue(
  agencyId: string,
  now: Date = new Date(),
): Promise<{ clients: QueueClient[]; posts: QueuePost[] }> {
  if (!supabaseConfigured()) {
    return { clients: demoQueueClients(), posts: demoQueuePosts() };
  }

  const supabase = await getDb();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("status", "active")
    .order("name");
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .in("client_id", [...clientById.keys()])
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const inMonth = torontoMonthTester(now);

  const queueClients: QueueClient[] = (clients ?? []).map((client) => {
    const cadence = monthlyCadence(
      (posts ?? []).filter((p) => p.client_id === client.id),
      client.posts_per_month,
      now,
    );
    return {
      id: client.id,
      name: client.name,
      remaining: cadence.remaining,
      late: cadence.late,
    };
  });

  const queuePosts: QueuePost[] = (posts ?? [])
    .filter((post) => post.status !== "published" || inMonth(post.published_at))
    .map((post) =>
      toQueuePost(
        supabase,
        post,
        clientById.get(post.client_id)?.name ?? "(client inconnu)",
      ),
    );

  return { clients: queueClients, posts: queuePosts };
}

/** File d'un seul client (onglet Posts de la fiche) : tous ses posts. */
export async function loadClientQueue(
  client: { id: string; name: string; posts_per_month: number },
  now: Date = new Date(),
): Promise<{ clients: QueueClient[]; posts: QueuePost[] }> {
  if (!supabaseConfigured()) {
    return {
      clients: demoQueueClients().filter((c) => c.id === client.id),
      posts: demoQueuePosts().filter((p) => p.clientId === client.id),
    };
  }

  const supabase = await getDb();

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("client_id", client.id)
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const cadence = monthlyCadence(posts ?? [], client.posts_per_month, now);

  return {
    clients: [
      {
        id: client.id,
        name: client.name,
        remaining: cadence.remaining,
        late: cadence.late,
      },
    ],
    posts: (posts ?? []).map((post) => toQueuePost(supabase, post, client.name)),
  };
}
