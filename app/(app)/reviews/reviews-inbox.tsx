"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { frCA } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/reviews/star-rating";
import { TabBar } from "@/components/ui/tab-bar";
import { cn } from "@/lib/utils";
import type { ReviewStatus } from "@/lib/types/database";
import type { InboxReview } from "@/lib/reviews/inbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ignoreReviewAction,
  publishReplyAction,
  regenerateReplyAction,
  unignoreReviewAction,
} from "./actions";

export type { InboxReview };

const MAX_REPLY_LENGTH = 4096;
const PENDING_STATUSES: ReviewStatus[] = [
  "needs_reply",
  "draft_ready",
  "approved",
];

type StatusFilter = "pending" | "all" | "replied" | "ignored";
type RatingFilter = "all" | "high" | "low";

function isPending(status: ReviewStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

function ageInHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600_000;
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function ReviewsInbox({ reviews }: { reviews: InboxReview[] }) {
  const [overrides, setOverrides] = useState<
    Record<string, Partial<InboxReview>>
  >({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const merged = useMemo(
    () => reviews.map((r) => ({ ...r, ...overrides[r.id] })),
    [reviews, overrides],
  );

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const review of reviews) map.set(review.clientId, review.clientName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [reviews]);

  const visible = useMemo(() => {
    const filtered = merged.filter((review) => {
      if (statusFilter === "pending" && !isPending(review.status))
        return false;
      if (statusFilter === "replied" && review.status !== "replied")
        return false;
      if (statusFilter === "ignored" && review.status !== "ignored")
        return false;
      if (ratingFilter === "high" && review.starRating < 4) return false;
      if (ratingFilter === "low" && review.starRating > 3) return false;
      if (clientFilter !== "all" && review.clientId !== clientFilter)
        return false;
      return true;
    });
    // Tri par gravité : une 1★ vieille de 3 jours passe devant dix 5★
    // fraîches — la file présente le bon ordre d'elle-même.
    return filtered.sort((a, b) => {
      const gravity = (r: InboxReview) =>
        !isPending(r.status)
          ? 3
          : r.starRating <= 2
            ? 0
            : r.starRating === 3
              ? 1
              : 2;
      const ga = gravity(a);
      const gb = gravity(b);
      if (ga !== gb) return ga - gb;
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      // En attente : la plus vieille d'abord; traitées : la plus récente.
      return ga < 3 ? ta - tb : tb - ta;
    });
  }, [merged, statusFilter, ratingFilter, clientFilter]);

  const applyOverride = useCallback(
    (id: string, patch: Partial<InboxReview> | null) => {
      setOverrides((prev) => {
        if (patch === null) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: { ...prev[id], ...patch } };
      });
    },
    [],
  );

  // Ouvre la première review en attente d'office : le draft et le bouton
  // Publier sont visibles sans clic.
  useEffect(() => {
    if (selectedId === null && statusFilter === "pending" && visible.length) {
      setSelectedId(visible[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à l'arrivée seulement
  }, []);

  // Après Publier/Ignorer : passe à la review en attente suivante.
  const advanceFrom = useCallback(
    (id: string) => {
      const ids = visible.map((r) => r.id);
      const index = ids.indexOf(id);
      const next =
        ids.slice(index + 1).find((candidate) => candidate !== id) ??
        ids.slice(0, index).find((candidate) => candidate !== id) ??
        null;
      setSelectedId(next);
      if (next) {
        document
          .getElementById(`review-${next}`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    },
    [visible],
  );

  // Raccourcis clavier : j/k naviguer, e éditer, Escape fermer (specs/05).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable;

      if (event.key === "Escape") {
        setSelectedId(null);
        (target as HTMLElement).blur?.();
        return;
      }
      if (typing) return;

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const ids = visible.map((r) => r.id);
        if (!ids.length) return;
        const index = selectedId ? ids.indexOf(selectedId) : -1;
        const next =
          event.key === "j"
            ? ids[Math.min(index + 1, ids.length - 1)]
            : ids[Math.max(index - 1, 0)];
        setSelectedId(next);
        document
          .getElementById(`review-${next}`)
          ?.scrollIntoView({ block: "nearest" });
      }
      if (event.key === "e" && selectedId) {
        event.preventDefault();
        document
          .getElementById(`draft-${selectedId}`)
          ?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, selectedId]);

  const pendingCount = merged.filter((r) => isPending(r.status)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 border-b border-border">
        <TabBar
          className="flex-1 border-b-0"
          activeKey={statusFilter}
          onSelect={(key) => setStatusFilter(key as StatusFilter)}
          items={[
            { key: "pending", label: "En attente", count: pendingCount },
            { key: "all", label: "Toutes" },
            { key: "replied", label: "Répondues" },
            { key: "ignored", label: "Ignorées" },
          ]}
        />

        <div className="flex items-center gap-2 pb-1.5">
        <Select
          value={clientFilter}
          onValueChange={(v) => setClientFilter(v as string)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {clients.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={ratingFilter}
          onValueChange={(v) => setRatingFilter(v as RatingFilter)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les notes</SelectItem>
            <SelectItem value="high">4–5 ★</SelectItem>
            <SelectItem value="low">1–3 ★</SelectItem>
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Raccourcis <kbd className="rounded border border-border px-1">?</kbd>
        </button>
        </div>
      </div>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Raccourcis clavier</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {(
              [
                ["j / k", "Naviguer entre les reviews"],
                ["e", "Éditer le draft sélectionné"],
                ["⌘↵ / Ctrl↵", "Publier la réponse"],
                ["Échap", "Fermer le panneau"],
                ["⌘K / CtrlK", "Rechercher un client"],
                ["?", "Afficher cette aide"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="contents">
                <dt>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-elevated px-6 py-16 text-center">
          <p className="text-lg">
            {statusFilter === "pending"
              ? "Aucune review en attente 🎉"
              : "Aucune review ne correspond aux filtres."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter === "pending"
              ? "Tout est répondu. Le sync tourne aux 30 minutes."
              : "Ajuste les filtres pour voir plus de reviews."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visible.map((review) => (
              <motion.li
                key={review.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <ReviewItem
                  review={review}
                  selected={selectedId === review.id}
                  onSelect={() =>
                    setSelectedId((current) =>
                      current === review.id ? null : review.id,
                    )
                  }
                  onOverride={applyOverride}
                  onDone={advanceFrom}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function ReviewItem({
  review,
  selected,
  onSelect,
  onOverride,
  onDone,
}: {
  review: InboxReview;
  selected: boolean;
  onSelect: () => void;
  onOverride: (id: string, patch: Partial<InboxReview> | null) => void;
  onDone: (id: string) => void;
}) {
  const pending = isPending(review.status);
  const late = pending && ageInHours(review.createdAt) > 72;

  return (
    <div
      id={`review-${review.id}`}
      className={cn(
        "rounded-lg border bg-elevated transition-colors",
        selected ? "border-ring" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {initials(review.reviewerName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {review.reviewerName ?? "Utilisateur Google"}
            </span>
            <StarRating value={review.starRating} size="sm" />
            <span className="text-xs text-muted-foreground">
              {review.clientName}
            </span>
            {review.wasUpdated && (
              <Badge variant="secondary">Avis modifié</Badge>
            )}
            <StatusBadge status={review.status} />
          </span>
          {review.comment ? (
            <span
              className={cn(
                "mt-1 block text-sm text-muted-foreground",
                !selected && "line-clamp-2",
              )}
            >
              {review.comment}
            </span>
          ) : (
            <span className="mt-1 block text-sm italic text-muted-foreground">
              (avis sans texte)
            </span>
          )}
          {!selected && pending && review.draftText && (
            <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
              <span className="text-success">Draft :</span> «{" "}
              {review.draftText} »
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "text-xs",
              late ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {formatDistanceToNow(new Date(review.createdAt), {
              addSuffix: true,
              locale: frCA,
            })}
          </span>
          {late && <Badge variant="destructive">&gt; 72 h</Badge>}
        </span>
      </button>

      {selected && pending && (
        <ReplyPanel review={review} onOverride={onOverride} onDone={onDone} />
      )}
      {selected && review.status === "replied" && review.publishedText && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            Réponse publiée
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {review.publishedText}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  switch (status) {
    case "needs_reply":
      return <Badge variant="destructive">Sans draft</Badge>;
    case "draft_ready":
      return <Badge variant="default">Draft prêt</Badge>;
    case "approved":
      return <Badge variant="secondary">À publier</Badge>;
    case "replied":
      return <Badge variant="secondary">Répondue</Badge>;
    case "ignored":
      return <Badge variant="outline">Ignorée</Badge>;
  }
}

function ReplyPanel({
  review,
  onOverride,
  onDone,
}: {
  review: InboxReview;
  onOverride: (id: string, patch: Partial<InboxReview> | null) => void;
  onDone: (id: string) => void;
}) {
  const [text, setText] = useState(review.draftText ?? "");
  const [directive, setDirective] = useState("");
  const [publishing, startPublish] = useTransition();
  const [regenerating, startRegenerate] = useTransition();
  const [ignoring, startIgnore] = useTransition();

  const busy = publishing || regenerating || ignoring;

  function publish() {
    const snapshot = review.status;
    // Optimistic : l'item quitte la liste « en attente » immédiatement.
    onOverride(review.id, { status: "replied", publishedText: text.trim() });
    onDone(review.id);
    startPublish(async () => {
      const result = await publishReplyAction(review.id, text);
      if (result.ok) {
        toast.success("Réponse publiée.");
      } else {
        onOverride(review.id, { status: snapshot, publishedText: null });
        toast.error(result.error);
      }
    });
  }

  function regenerate() {
    startRegenerate(async () => {
      const result = await regenerateReplyAction(
        review.id,
        directive || undefined,
      );
      if (result.ok && result.draft) {
        setText(result.draft);
        setDirective("");
        onOverride(review.id, {
          status: "draft_ready",
          draftText: result.draft,
        });
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function ignore() {
    const snapshot = review.status;
    onOverride(review.id, { status: "ignored" });
    onDone(review.id);
    startIgnore(async () => {
      const result = await ignoreReviewAction(review.id);
      if (result.ok) {
        toast.success("Review ignorée.", {
          action: {
            label: "Annuler",
            onClick: () => {
              onOverride(review.id, { status: snapshot });
              void unignoreReviewAction(review.id);
            },
          },
        });
      } else {
        onOverride(review.id, { status: snapshot });
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
      {review.generationCount >= 3 && (
        <p className="text-xs text-amber-500">
          Ce draft a été régénéré {review.generationCount} fois — le profil de
          marque du client mérite probablement d&apos;être enrichi (fiche
          client → Réglages).
        </p>
      )}
      <Textarea
        id={`draft-${review.id}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (text.trim() && !busy) publish();
          }
        }}
        rows={4}
        maxLength={MAX_REPLY_LENGTH}
        placeholder={
          review.status === "needs_reply"
            ? "Pas encore de draft — régénère ou écris la réponse."
            : undefined
        }
        className="text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={publish}
          disabled={busy || !text.trim()}
        >
          {publishing ? "Publication…" : "Publier la réponse"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={regenerate}
          disabled={busy}
        >
          <Sparkles />
          {regenerating ? "Rédaction…" : "Régénérer"}
        </Button>
        <Input
          value={directive}
          onChange={(event) => setDirective(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) {
              event.preventDefault();
              regenerate();
            }
          }}
          placeholder="Directive (optionnel) : « plus court », « mentionne la garantie »…"
          className="h-7 w-80 text-xs"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={ignore}
          disabled={busy}
          className="ml-auto text-muted-foreground"
        >
          {ignoring ? "…" : "Ignorer"}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {text.length}/{MAX_REPLY_LENGTH}
        </span>
      </div>
    </div>
  );
}
