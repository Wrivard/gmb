"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { frCA } from "date-fns/locale";
import {
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  Sparkles,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";
import { cn } from "@/lib/utils";
import type { PostStatus } from "@/lib/types/database";
import { POST_STATUS_LABELS_FR, postGroup } from "@/lib/posts/status";
import type { QueueClient, QueuePost } from "@/lib/posts/queue";
import { TabBar } from "@/components/ui/tab-bar";
import { generatePostAction } from "./actions";

export type { QueueClient, QueuePost };

function StatusBadge({ status }: { status: PostStatus }) {
  const group = postGroup(status);
  const variant =
    group === "echec"
      ? "destructive"
      : group === "publie"
        ? "secondary"
        : group === "brouillon"
          ? "outline"
          : "default";
  return <Badge variant={variant}>{POST_STATUS_LABELS_FR[status]}</Badge>;
}

export function PostsView({
  clients,
  posts,
  backHref,
  hasProjects = true,
}: {
  clients: QueueClient[];
  posts: QueuePost[];
  /** Contexte d'origine (ex. fiche projet) — propagé à l'éditeur pour
      que « retour » et l'après-approbation reviennent ici. */
  backHref?: string;
  /** false = aucun projet connecté : l'état vide oriente vers Agence. */
  hasProjects?: boolean;
}) {
  const [view, setView] = useState<"queue" | "calendar">("queue");
  const postHref = (id: string) =>
    backHref
      ? `/posts/${id}?back=${encodeURIComponent(backHref)}`
      : `/posts/${id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 border-b border-border">
        <TabBar
          className="flex-1 border-b-0"
          activeKey={view}
          onSelect={(key) => setView(key as "queue" | "calendar")}
          items={[
            { key: "queue", label: "À traiter" },
            { key: "calendar", label: "Calendrier" },
          ]}
        />
        <div className="pb-1.5">
          <BatchGenerateButton clients={clients} />
        </div>
      </div>

      {view === "queue" ? (
        <QueueView
          clients={clients}
          posts={posts}
          postHref={postHref}
          hasProjects={hasProjects}
        />
      ) : (
        <CalendarView posts={posts} postHref={postHref} />
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
  const cancelRef = useRef(false);

  // Naviguer pendant le lot démonte le composant : les posts déjà créés
  // survivent (chaque appel est persisté serveur), mais la suite du lot
  // et le bilan seraient perdus sans prévenir.
  useUnsavedGuard(
    pending,
    "Une génération en lot est en cours — quitter la page interrompt le reste du lot. Continuer ?",
  );

  const jobs = useMemo(
    () =>
      clients.flatMap((client) =>
        Array.from({ length: client.remaining }, () => client),
      ),
    [clients],
  );

  if (!jobs.length) return null;

  function run() {
    cancelRef.current = false;
    startTransition(async () => {
      setProgress({ done: 0, total: jobs.length });
      let failures = 0;
      let done = 0;
      // Séquentiel avec pause 500 ms entre les appels (specs/07).
      // La barre de progression suffit — on ne toaste que les échecs,
      // sinon 10 clients = un mur de toasts qui masque l'écran.
      for (let i = 0; i < jobs.length; i++) {
        if (cancelRef.current) break;
        const result = await generatePostAction(jobs[i].id);
        done++;
        if (!result.ok) {
          failures++;
          toast.error(`${jobs[i].name} : ${result.error}`);
        }
        setProgress({ done, total: jobs.length });
        if (i < jobs.length - 1 && !cancelRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      setProgress(null);
      router.refresh();
      if (cancelRef.current) {
        toast.info(
          `Lot arrêté après ${done}/${jobs.length} — les posts créés sont dans « À réviser ».`,
        );
      } else if (failures) {
        toast.warning(
          `${done - failures}/${jobs.length} posts générés — ${failures} échec${failures > 1 ? "s" : ""}.`,
        );
      } else {
        toast.success("Tous les posts dus sont générés.");
      }
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
      {pending && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            cancelRef.current = true;
          }}
        >
          Arrêter
        </Button>
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
  postHref,
  hasProjects = true,
}: {
  clients: QueueClient[];
  posts: QueuePost[];
  postHref: (id: string) => string;
  hasProjects?: boolean;
}) {
  const due = clients.filter((c) => c.remaining > 0);
  const drafts = posts.filter((p) => postGroup(p.status) === "brouillon");
  const failed = posts.filter((p) => postGroup(p.status) === "echec");
  const scheduled = posts.filter((p) => postGroup(p.status) === "planifie");
  const published = posts.filter((p) => postGroup(p.status) === "publie");

  const remainingTotal = due.reduce((sum, c) => sum + c.remaining, 0);
  const todoCount = remainingTotal + drafts.length + failed.length;
  const nextScheduled = scheduled.find((p) => p.scheduledFor);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {/* Zone action : ce qui attend une décision humaine. */}
      {todoCount === 0 ? (
        !hasProjects ? (
          <EmptyState
            icon={Unplug}
            title="Aucun projet connecté"
            hint={
              <>
                Connecte le compte Google dans{" "}
                <a href="/settings" className="underline">
                  Agence
                </a>{" "}
                — les posts se génèrent selon la cadence de chaque projet.
              </>
            }
          />
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Rien à traiter"
            hint={
              nextScheduled?.scheduledFor
                ? `Prochain post : ${nextScheduled.clientName}, le ${format(
                    new Date(nextScheduled.scheduledFor),
                    "d MMMM à HH:mm",
                    { locale: frCA },
                  )} (publication automatique).`
                : "La cadence du mois est couverte pour tous les clients."
            }
          />
        )
      ) : (
        <>
          {failed.length > 0 && (
            <Section
              title="À corriger"
              count={failed.length}
              hint="La publication a échoué chez Google. Ouvre le post, ajuste, réessaie."
            >
              <PostRows posts={failed} action="Corriger" postHref={postHref} />
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
              <PostRows posts={drafts} action="Réviser" postHref={postHref} />
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
              <PostRows posts={scheduled} quiet postHref={postHref} />
            </Section>
          )}

          {published.length > 0 && (
            <Section title="Publiés ce mois" count={published.length} quiet>
              <PostRows posts={published} quiet postHref={postHref} />
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
  const [directive, setDirective] = useState("");
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generatePostAction(client.id, directive);
      if (result.ok) {
        toast.success(`Post généré pour ${client.name}.`);
        setDirective("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

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
      {/* L'angle se donne AVANT la génération — sinon on brûle toujours
          une génération à l'aveugle puis on régénère avec directive. */}
      <Input
        value={directive}
        onChange={(event) => setDirective(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !pending) {
            event.preventDefault();
            generate();
          }
        }}
        aria-label={`Angle du post pour ${client.name}`}
        placeholder="Angle (optionnel) : « promo de juin »…"
        className="h-7 w-56 text-xs"
        disabled={pending}
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={generate}>
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
  postHref,
}: {
  posts: QueuePost[];
  action?: string;
  quiet?: boolean;
  postHref: (id: string) => string;
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
            href={postHref(post.id)}
            className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover/50"
          >
            <div
              className={cn(
                "shrink-0 overflow-hidden rounded bg-muted",
                quiet ? "size-8" : "size-10",
              )}
            >
              {post.imageUrl ? (
                <Image
                  src={post.imageUrl}
                  alt=""
                  width={80}
                  height={80}
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

function CalendarView({
  posts,
  postHref,
}: {
  posts: QueuePost[];
  postHref: (id: string) => string;
}) {
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
      <h2 className="mb-2 text-sm font-medium capitalize text-muted-foreground">
        {format(now, "MMMM yyyy", { locale: frCA })}
      </h2>
      {byDay.size === 0 && (
        <EmptyState
          size="sm"
          className="mb-2"
          title="Aucun post planifié ou publié ce mois-ci"
          hint="Les posts approuvés apparaissent ici à leur date de publication."
        />
      )}
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
                  href={postHref(post.id)}
                  className={cn(
                    // Mêmes couleurs que StatusBadge : un statut = une
                    // couleur, peu importe la vue.
                    "truncate rounded px-1.5 py-0.5 text-xs",
                    postGroup(post.status) === "publie"
                      ? "bg-secondary text-secondary-foreground"
                      : postGroup(post.status) === "echec"
                        ? "bg-destructive/10 text-destructive"
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
