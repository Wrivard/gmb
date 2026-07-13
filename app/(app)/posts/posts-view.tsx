"use client";

// File de posts en pipeline — la page se lit comme le workflow réel :
// ① une idée → génération (texte + image + date), ② réviser/replacer
// les brouillons, ③ le calendrier du mois comme vue de contrôle.
// Partagé entre la file agence (/posts) et l'onglet Posts d'un projet.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { frCA } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Sparkles,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeletePostButton } from "@/components/posts/delete-post-button";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";
import { cn } from "@/lib/utils";
import { POST_STATUS_LABELS_FR, postGroup } from "@/lib/posts/status";
import type { QueueClient, QueuePost } from "@/lib/posts/queue";
import { generatePostAction, reschedulePostAction } from "./actions";

export type { QueueClient, QueuePost };

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const sectionMotion = (index: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: index * 0.08, ease: "easeOut" as const },
});

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
  const postHref = (id: string) =>
    backHref
      ? `/posts/${id}?back=${encodeURIComponent(backHref)}`
      : `/posts/${id}`;

  if (!hasProjects) {
    return (
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
    );
  }

  return (
    <FilteredPipeline clients={clients} posts={posts} postHref={postHref} />
  );
}

function FilteredPipeline({
  clients,
  posts,
  postHref,
}: {
  clients: QueueClient[];
  posts: QueuePost[];
  postHref: (id: string) => string;
}) {
  const single = clients.length === 1;
  // Le projet choisi dans ① filtre TOUTE la page : projet A coché →
  // seulement les posts de A dans « À réviser » et le calendrier.
  const [filterId, setFilterId] = useState<string>(
    single ? clients[0].id : "all",
  );
  const filtered =
    filterId === "all" ? posts : posts.filter((p) => p.clientId === filterId);
  const filteredClients =
    filterId === "all" ? clients : clients.filter((c) => c.id === filterId);
  const filterName = clients.find((c) => c.id === filterId)?.name;

  const drafts = filtered.filter((p) => postGroup(p.status) === "brouillon");
  const failed = filtered.filter((p) => postGroup(p.status) === "echec");

  // Tant qu'une image se génère en différé, on repasse chercher le
  // résultat — le flag imagePending expire seul côté serveur (3 min).
  const router = useRouter();
  const hasPendingImage = filtered.some((p) => p.imagePending);
  useEffect(() => {
    if (!hasPendingImage) return;
    const interval = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(interval);
  }, [hasPendingImage, router]);

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <motion.div {...sectionMotion(0)}>
        <StepHeader
          step={1}
          title="Nouvelle idée"
          hint="L'angle et la date se donnent AVANT la génération — le texte et l'image arrivent prêts à réviser."
        />
        {!single && (
          <DueStrip
            clients={clients}
            filterId={filterId}
            onFilterChange={setFilterId}
          />
        )}
        <IdeaComposer
          clients={clients}
          batchClients={filteredClients}
          filterId={filterId}
          onFilterChange={setFilterId}
          single={single}
        />
      </motion.div>

      <motion.div {...sectionMotion(1)}>
        <StepHeader
          step={2}
          title="À réviser"
          count={drafts.length + failed.length}
          hint="Vérifie le texte et l'image, ajuste la date au besoin, puis approuve."
        />
        {failed.length + drafts.length === 0 ? (
          <EmptyState
            size="sm"
            title={
              filterName ? `Rien à réviser pour ${filterName}` : "Rien à réviser"
            }
            hint="Les brouillons générés apparaissent ici, avec leur date suggérée."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {failed.length > 0 && (
              <PostRows
                posts={failed}
                action="Corriger"
                postHref={postHref}
                tone="failed"
              />
            )}
            {drafts.length > 0 && (
              <PostRows posts={drafts} action="Réviser" postHref={postHref} />
            )}
          </div>
        )}
      </motion.div>

      <motion.div {...sectionMotion(2)}>
        <StepHeader
          step={3}
          title="Calendrier"
          hint={
            filterName
              ? `Les posts de ${filterName} seulement — brouillons, planifiés, publiés.`
              : "Brouillons à leur date suggérée, posts planifiés (publication automatique) et publiés."
          }
        />
        <CalendarView posts={filtered} postHref={postHref} />
      </motion.div>
    </div>
  );
}

function StepHeader({
  step,
  title,
  count,
  hint,
}: {
  step: number;
  title: string;
  count?: number;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
        {step}
      </span>
      <h2 className="text-sm font-medium">{title}</h2>
      {count !== undefined && (
        <span className="text-sm tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
      {hint && (
        <p className="ml-2 hidden text-xs text-muted-foreground sm:block">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ── ① Nouvelle idée ─────────────────────────────────────────────── */

/**
 * Les projets qui attendent des posts, en un coup d'œil — cliquer une
 * puce sélectionne le projet (et filtre toute la page), re-cliquer
 * revient à « Tous ». Même langage couleur que la couverture de
 * cadence : ambre = dû, rouge = en retard.
 */
function DueStrip({
  clients,
  filterId,
  onFilterChange,
}: {
  clients: QueueClient[];
  filterId: string;
  onFilterChange: (id: string) => void;
}) {
  const due = [...clients]
    .filter((client) => client.remaining > 0)
    .sort(
      (a, b) =>
        Number(b.late) - Number(a.late) ||
        b.remaining - a.remaining ||
        a.name.localeCompare(b.name),
    );

  if (!due.length) {
    return (
      <p className="mb-2 text-xs text-muted-foreground">
        Cadence du mois couverte pour tous les projets.
      </p>
    );
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {due.map((client) => {
        const active = filterId === client.id;
        return (
          <button
            key={client.id}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(active ? "all" : client.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border py-1 pr-1.5 pl-3 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "border-ring bg-muted text-foreground"
                : "border-border bg-elevated text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            <span className="max-w-44 truncate font-medium">
              {client.name}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                client.late
                  ? "bg-destructive/15 text-destructive"
                  : "bg-warning/15 text-warning",
              )}
            >
              {client.remaining} dû{client.remaining > 1 ? "s" : ""}
              {client.late && " · retard"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function IdeaComposer({
  clients,
  batchClients,
  filterId,
  onFilterChange,
  single,
}: {
  clients: QueueClient[];
  /** Cible du lot « générer tous les posts dus » — suit le filtre. */
  batchClients: QueueClient[];
  filterId: string;
  onFilterChange: (id: string) => void;
  single: boolean;
}) {
  const router = useRouter();
  const [directive, setDirective] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();

  const clientId = filterId === "all" ? "" : filterId;
  const selected = clients.find((c) => c.id === clientId);

  // Base UI n'affiche le label du choix (au lieu de la valeur brute —
  // ici un UUID) que si le root reçoit `items`.
  const selectItems = [
    { value: "all", label: "Tous les projets" },
    ...clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  function generate() {
    if (!clientId) return;
    startTransition(async () => {
      const result = await generatePostAction(
        clientId,
        directive,
        date ? new Date(date).toISOString() : undefined,
      );
      if (result.ok) {
        toast.success(
          `Texte prêt pour ${selected?.name ?? "le projet"} — l'image arrive dans quelques secondes.`,
        );
        setDirective("");
        setDate("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <div className="flex flex-wrap items-end gap-3">
        {!single && (
          <div className="flex w-60 flex-col gap-1.5">
            <Label htmlFor="idea-client" className="text-xs">
              Projet
            </Label>
            <Select
              items={selectItems}
              value={filterId}
              onValueChange={(value) => value && onFilterChange(value)}
            >
              <SelectTrigger id="idea-client" className="w-full">
                <SelectValue placeholder="Choisir un projet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                    {client.remaining > 0 &&
                      ` — ${client.remaining} dû${client.remaining > 1 ? "s" : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="idea-directive" className="text-xs">
            Idée / angle{" "}
            <span className="font-normal text-muted-foreground">
              (optionnel)
            </span>
          </Label>
          <Input
            id="idea-directive"
            value={directive}
            onChange={(event) => setDirective(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !pending) {
                event.preventDefault();
                generate();
              }
            }}
            placeholder="« promo de juin », « nouvelle tôle en stock »…"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idea-date" className="text-xs">
            Publication{" "}
            <span className="font-normal text-muted-foreground">
              (auto si vide)
            </span>
          </Label>
          <Input
            id="idea-date"
            type="datetime-local"
            value={date}
            min={toDatetimeLocal(new Date().toISOString())}
            onChange={(event) => setDate(event.target.value)}
            className="w-52 tabular-nums"
            disabled={pending}
          />
        </div>
        <Button onClick={generate} disabled={pending || !clientId}>
          <Sparkles />
          {pending ? "Rédaction…" : "Générer"}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {selected ? (
          <p className="text-xs text-muted-foreground">
            {selected.remaining > 0 ? (
              <>
                Cadence : {selected.remaining} post
                {selected.remaining > 1 ? "s" : ""} restant
                {selected.remaining > 1 ? "s" : ""} ce mois-ci
                {selected.late && (
                  <span className="ml-1 font-medium text-destructive">
                    — en retard
                  </span>
                )}
              </>
            ) : (
              "Cadence du mois couverte — un post de plus reste possible."
            )}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Choisis un projet pour générer un post — la page se filtre sur lui.
          </p>
        )}
        <BatchGenerateButton clients={batchClients} />
      </div>
    </div>
  );
}

function BatchGenerateButton({ clients }: { clients: QueueClient[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
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

  // Le lot n'a de sens que s'il couvre plus qu'une génération manuelle.
  if (jobs.length < 2) return null;

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
      <Button size="sm" variant="outline" onClick={run} disabled={pending}>
        <Sparkles />
        {pending
          ? "Génération…"
          : `Générer tous les posts dus (${jobs.length})`}
      </Button>
    </div>
  );
}

/* ── ② À réviser ─────────────────────────────────────────────────── */

function InlineSchedule({ post }: { post: QueuePost }) {
  const router = useRouter();
  const committed = toDatetimeLocal(post.scheduledFor);
  const [value, setValue] = useState(committed);
  const [pending, startTransition] = useTransition();

  function commit() {
    if (!value || value === committed) return;
    startTransition(async () => {
      const result = await reschedulePostAction(
        post.id,
        new Date(value).toISOString(),
      );
      if (result.ok) {
        toast.success(
          `${post.clientName} — replanifié au ${format(new Date(value), "d MMMM à HH:mm", { locale: frCA })}.`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
        setValue(committed);
      }
    });
  }

  return (
    <Input
      type="datetime-local"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      // Le clic sur l'input ne doit pas suivre le lien de la rangée.
      onClick={(event) => event.stopPropagation()}
      aria-label={`Date de publication — ${post.clientName}`}
      className="h-7 w-44 text-xs tabular-nums"
      disabled={pending}
    />
  );
}

function PostRows({
  posts,
  action,
  postHref,
  tone,
}: {
  posts: QueuePost[];
  action: string;
  postHref: (id: string) => string;
  tone?: "failed";
}) {
  const router = useRouter();
  return (
    <ul
      className={cn(
        "divide-y divide-border rounded-lg border bg-elevated",
        tone === "failed" ? "border-destructive/40" : "border-border",
      )}
    >
      {posts.map((post) => (
        <li
          key={post.id}
          className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover/50"
          onClick={() => router.push(postHref(post.id))}
        >
          <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">
            {post.imageUrl ? (
              <Image
                src={post.imageUrl}
                alt=""
                width={80}
                height={80}
                className="size-full object-cover"
              />
            ) : post.imagePending ? (
              <div
                className="flex size-full items-center justify-center text-muted-foreground"
                title="Image en génération — elle apparaîtra d'elle-même."
              >
                <Loader2 className="size-3.5 animate-spin" />
              </div>
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-3.5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{post.clientName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {post.summary}
            </p>
            {post.publishError && (
              <p className="mt-0.5 line-clamp-1 text-xs text-destructive">
                {post.publishError}
              </p>
            )}
          </div>
          <InlineSchedule post={post} />
          <Link
            href={postHref(post.id)}
            onClick={(event) => event.stopPropagation()}
            className="flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium text-foreground"
          >
            {action}
            <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
          <DeletePostButton postId={post.id} clientName={post.clientName} />
        </li>
      ))}
    </ul>
  );
}

/* ── ③ Calendrier ────────────────────────────────────────────────── */

function CalendarView({
  posts,
  postHref,
}: {
  posts: QueuePost[];
  postHref: (id: string) => string;
}) {
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const shown = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lundi = colonne 1.
  const gridStart = (shown.getDay() + 6) % 7;

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

  const isCurrentMonth = offset === 0;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <h3 className="text-sm font-medium capitalize text-muted-foreground">
          {format(shown, "MMMM yyyy", { locale: frCA })}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          {!isCurrentMonth && (
            <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
              Aujourd&apos;hui
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Mois précédent"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Mois suivant"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
          <div
            key={label}
            className="bg-elevated px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: gridStart }).map((_, i) => (
          <div key={`pad-${i}`} className="min-h-24 bg-background" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <div key={day} className="min-h-24 bg-elevated p-1.5">
            <span
              className={cn(
                "text-xs",
                isCurrentMonth && day === now.getDate()
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
                  title={`${post.clientName} — ${POST_STATUS_LABELS_FR[post.status]}`}
                  className={cn(
                    // Mêmes couleurs que StatusBadge : un statut = une
                    // couleur, peu importe la vue.
                    "truncate rounded px-1.5 py-0.5 text-xs",
                    postGroup(post.status) === "publie"
                      ? "bg-secondary text-secondary-foreground"
                      : postGroup(post.status) === "echec"
                        ? "bg-destructive/10 text-destructive"
                        : postGroup(post.status) === "brouillon"
                          ? "border border-dashed border-border text-muted-foreground"
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
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm border border-dashed border-border" />
          brouillon (date suggérée)
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-primary/40" />
          planifié — part tout seul
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm bg-secondary" />
          publié
        </span>
      </p>
    </div>
  );
}
