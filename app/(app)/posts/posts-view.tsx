"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { frCA } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ImageIcon,
  List,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PostStatus } from "@/lib/types/database";
import { generatePostAction } from "./actions";

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

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Brouillon",
  approved: "Approuvé",
  scheduled: "Planifié",
  publishing: "Publication…",
  published: "Publié",
  failed: "Échec",
};

function StatusBadge({ status }: { status: PostStatus }) {
  const variant =
    status === "failed"
      ? "destructive"
      : status === "published"
        ? "secondary"
        : status === "draft"
          ? "outline"
          : "default";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

export function PostsView({
  clients,
  posts,
}: {
  clients: QueueClient[];
  posts: QueuePost[];
}) {
  const [view, setView] = useState<"queue" | "calendar">("queue");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-elevated p-1">
          {(
            [
              ["queue", "À traiter", List],
              ["calendar", "Calendrier", CalendarDays],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
                view === value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <BatchGenerateButton clients={clients} />
      </div>

      {view === "queue" ? (
        <QueueView clients={clients} posts={posts} />
      ) : (
        <CalendarView posts={posts} />
      )}
    </div>
  );
}

function BatchGenerateButton({ clients }: { clients: QueueClient[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const jobs = useMemo(
    () =>
      clients.flatMap((client) =>
        Array.from({ length: client.remaining }, () => client),
      ),
    [clients],
  );

  if (!jobs.length) return null;

  function run() {
    startTransition(async () => {
      setProgress({ done: 0, total: jobs.length });
      let failures = 0;
      // Séquentiel avec pause 500 ms entre les appels (specs/07).
      for (let i = 0; i < jobs.length; i++) {
        const result = await generatePostAction(jobs[i].id);
        if (result.ok) {
          toast.success(`Post généré pour ${jobs[i].name}.`);
        } else {
          failures++;
          toast.error(`${jobs[i].name} : ${result.error}`);
        }
        setProgress({ done: i + 1, total: jobs.length });
        if (i < jobs.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      setProgress(null);
      router.refresh();
      if (!failures) toast.success("Tous les posts dus sont générés.");
    });
  }

  return (
    <div className="ml-auto flex items-center gap-3">
      {progress && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
      <Button size="sm" onClick={run} disabled={pending}>
        <Sparkles />
        {pending
          ? "Génération…"
          : `Générer tous les posts dus (${jobs.length})`}
      </Button>
    </div>
  );
}

function QueueView({
  clients,
  posts,
}: {
  clients: QueueClient[];
  posts: QueuePost[];
}) {
  const due = clients.filter((c) => c.remaining > 0);
  const drafts = posts.filter((p) => p.status === "draft");
  const failed = posts.filter((p) => p.status === "failed");
  const scheduled = posts.filter(
    (p) =>
      p.status === "scheduled" ||
      p.status === "approved" ||
      p.status === "publishing",
  );
  const published = posts.filter((p) => p.status === "published");

  const remainingTotal = due.reduce((sum, c) => sum + c.remaining, 0);
  const todoCount = remainingTotal + drafts.length + failed.length;
  const nextScheduled = scheduled.find((p) => p.scheduledFor);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {/* Zone action : ce qui attend une décision humaine. */}
      {todoCount === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-elevated px-6 py-14 text-center">
          <CheckCircle2 className="size-7 text-success" />
          <p className="text-base font-medium">Rien à traiter.</p>
          <p className="text-sm text-muted-foreground">
            {nextScheduled?.scheduledFor
              ? `Prochain post : ${nextScheduled.clientName}, le ${format(
                  new Date(nextScheduled.scheduledFor),
                  "d MMMM à HH:mm",
                  { locale: frCA },
                )} (publication automatique).`
              : "La cadence du mois est couverte pour tous les clients."}
          </p>
        </div>
      ) : (
        <>
          {failed.length > 0 && (
            <Section
              title="À corriger"
              count={failed.length}
              hint="La publication a échoué chez Google. Ouvre le post, ajuste, réessaie."
            >
              <PostRows posts={failed} action="Corriger" />
            </Section>
          )}

          {due.length > 0 && (
            <Section
              title="À créer"
              count={remainingTotal}
              hint="Un clic génère le texte et l'image, à réviser ensuite."
            >
              <ul className="divide-y divide-border rounded-lg border border-border bg-elevated">
                {due.map((client) => (
                  <DueClientRow key={client.id} client={client} />
                ))}
              </ul>
            </Section>
          )}

          {drafts.length > 0 && (
            <Section
              title="À réviser"
              count={drafts.length}
              hint="Vérifie le texte et l'image, puis approuve."
            >
              <PostRows posts={drafts} action="Réviser" />
            </Section>
          )}
        </>
      )}

      {/* Zone automatique : rien à faire, l'app s'en occupe. */}
      {(scheduled.length > 0 || published.length > 0) && (
        <div className="flex flex-col gap-8 border-t border-border pt-8">
          {scheduled.length > 0 && (
            <Section
              title="Publication automatique"
              count={scheduled.length}
              hint="Chaque post part tout seul à la date prévue."
              quiet
            >
              <PostRows posts={scheduled} quiet />
            </Section>
          )}

          {published.length > 0 && (
            <Section title="Publiés ce mois" count={published.length} quiet>
              <PostRows posts={published} quiet />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  hint,
  quiet = false,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h2
          className={cn(
            "text-sm font-medium",
            quiet && "text-muted-foreground",
          )}
        >
          {title}
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {count}
        </span>
        {hint && (
          <p className="ml-2 hidden text-xs text-muted-foreground sm:block">
            {hint}
          </p>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function DueClientRow({ client }: { client: QueueClient }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="text-sm">{client.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {client.remaining} post{client.remaining > 1 ? "s" : ""} restant
          {client.remaining > 1 ? "s" : ""}
        </span>
        {client.late && (
          <span className="ml-2 text-xs font-medium text-destructive">
            en retard
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await generatePostAction(client.id);
            if (result.ok) {
              toast.success(`Post généré pour ${client.name}.`);
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        <Sparkles />
        {pending ? "Rédaction…" : "Générer"}
      </Button>
    </li>
  );
}

function postDateLabel(post: QueuePost): string {
  if (post.status === "published" && post.publishedAt) {
    return `Publié le ${format(new Date(post.publishedAt), "d MMM", { locale: frCA })}`;
  }
  if (post.scheduledFor) {
    return `le ${format(new Date(post.scheduledFor), "d MMM à HH:mm", { locale: frCA })}`;
  }
  return "Sans date";
}

function PostRows({
  posts,
  action,
  quiet = false,
}: {
  posts: QueuePost[];
  action?: string;
  quiet?: boolean;
}) {
  return (
    <ul
      className={cn(
        "divide-y divide-border rounded-lg border border-border",
        quiet ? "bg-transparent" : "bg-elevated",
      )}
    >
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            href={`/posts/${post.id}`}
            className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover/50"
          >
            <div
              className={cn(
                "shrink-0 overflow-hidden rounded bg-muted",
                quiet ? "size-8" : "size-10",
              )}
            >
              {post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniature Storage
                <img
                  src={post.imageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="size-3.5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm">{post.clientName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {post.summary}
                </span>
              </div>
              {post.publishError && (
                <p className="mt-0.5 line-clamp-1 text-xs text-destructive">
                  {post.publishError}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {postDateLabel(post)}
            </span>
            {action ? (
              <span className="flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium text-foreground">
                {action}
                <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
            ) : (
              <span className="flex w-20 shrink-0 justify-end">
                <StatusBadge status={post.status} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CalendarView({ posts }: { posts: QueuePost[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lundi = colonne 1.
  const offset = (firstDay.getDay() + 6) % 7;

  const byDay = new Map<number, QueuePost[]>();
  for (const post of posts) {
    const iso =
      post.status === "published" ? post.publishedAt : post.scheduledFor;
    if (!iso) continue;
    const date = new Date(iso);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const day = date.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), post]);
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
        {format(now, "MMMM yyyy", { locale: frCA })}
      </h2>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
          <div
            key={label}
            className="bg-elevated px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-24 bg-background" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <div key={day} className="min-h-24 bg-elevated p-1.5">
            <span
              className={cn(
                "text-xs",
                day === now.getDate()
                  ? "font-semibold text-primary"
                  : "text-muted-foreground",
              )}
            >
              {day}
            </span>
            <div className="mt-1 flex flex-col gap-1">
              {(byDay.get(day) ?? []).map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className={cn(
                    "truncate rounded px-1.5 py-0.5 text-[11px]",
                    post.status === "published"
                      ? "bg-muted text-muted-foreground"
                      : post.status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary",
                  )}
                >
                  {post.clientName}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
