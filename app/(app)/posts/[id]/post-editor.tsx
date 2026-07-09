"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PostPreview } from "@/components/posts/post-preview";
import { useUnsavedGuard } from "@/lib/hooks/use-unsaved-guard";
import { cn } from "@/lib/utils";
import type { CtaType, PostStatus } from "@/lib/types/database";
import {
  approvePostAction,
  publishPostNowAction,
  regeneratePostImageAction,
  updatePostAction,
  uploadPostImageAction,
} from "../actions";
import {
  isPostApprovable,
  isPostEditable,
  POST_STATUS_LABELS_FR,
  postGroup,
} from "@/lib/posts/status";

const MAX_SUMMARY_LENGTH = 1500;

interface EditorPost {
  id: string;
  summary: string;
  ctaType: CtaType | null;
  ctaUrl: string | null;
  status: PostStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishError: string | null;
  imagePrompt: string | null;
  imageUrl: string | null;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PostEditor({
  post,
  clientName,
  clientWebsite,
  backHref = "/posts",
}: {
  post: EditorPost;
  clientName: string;
  clientWebsite: string | null;
  /** Où revenir après approbation/publication — la file d'origine. */
  backHref?: string;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(post.summary);
  const [ctaType, setCtaType] = useState<CtaType | "none">(
    post.ctaType ?? "none",
  );
  const [ctaUrl, setCtaUrl] = useState(post.ctaUrl ?? clientWebsite ?? "");
  const [scheduledFor, setScheduledFor] = useState(
    toDatetimeLocal(post.scheduledFor),
  );
  const [imageDirective, setImageDirective] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [saving, startSave] = useTransition();
  const [approving, startApprove] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [imageBusy, startImage] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = saving || approving || publishing || imageBusy;
  const readOnly = !isPostEditable(post.status);

  // Après un save réussi, router.refresh() remet les props post.* au
  // niveau de l'état local → dirty retombe à false tout seul.
  const dirty =
    !readOnly &&
    (summary !== post.summary ||
      ctaType !== (post.ctaType ?? "none") ||
      ctaUrl !== (post.ctaUrl ?? clientWebsite ?? "") ||
      scheduledFor !== toDatetimeLocal(post.scheduledFor));
  // busy = un save/approve/publish est déjà en route vers la sortie.
  useUnsavedGuard(dirty && !busy);

  /** Erreur bloquante avant tout envoi vers Google, sinon null. */
  function validate(): string | null {
    if (!summary.trim()) return "Le texte du post est vide.";
    if (ctaType === "LEARN_MORE") {
      try {
        const url = new URL(ctaUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        return "L'URL du bouton est invalide — elle doit commencer par https://.";
      }
    }
    return null;
  }

  function save(then?: () => void) {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    startSave(async () => {
      const result = await updatePostAction(post.id, {
        summary,
        ctaType: ctaType === "none" ? null : ctaType,
        ctaUrl: ctaType === "LEARN_MORE" ? ctaUrl : null,
        scheduledFor: scheduledFor
          ? new Date(scheduledFor).toISOString()
          : null,
      });
      if (result.ok) {
        toast.success("Post enregistré.");
        router.refresh();
        then?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  function approve() {
    // Approuver = publication automatique à la date prévue : la date ne
    // doit pas déjà être passée.
    if (scheduledFor && new Date(scheduledFor).getTime() < Date.now()) {
      toast.error(
        "La date de publication est déjà passée — choisis une date future ou « Publier maintenant ».",
      );
      return;
    }
    save(() =>
      startApprove(async () => {
        const result = await approvePostAction(post.id);
        if (result.ok) {
          toast.success("Post approuvé et planifié.");
          router.push(backHref);
        } else {
          toast.error(result.error);
        }
      }),
    );
  }

  function publishNow() {
    setConfirmPublish(false);
    save(() =>
      startPublish(async () => {
        const result = await publishPostNowAction(post.id);
        if (result.ok) {
          toast.success("Post publié.");
          router.push(backHref);
        } else {
          toast.error(result.error);
          router.refresh();
        }
      }),
    );
  }

  function regenerateImage() {
    startImage(async () => {
      const result = await regeneratePostImageAction(
        post.id,
        imageDirective || undefined,
      );
      if (result.ok) {
        toast.success("Image régénérée.");
        setImageDirective("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function uploadImage(file: File) {
    startImage(async () => {
      const formData = new FormData();
      formData.set("image", file);
      const result = await uploadPostImageAction(post.id, formData);
      if (result.ok) {
        toast.success("Image remplacée.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href={backHref} />}>
          <ArrowLeft />
          {backHref.startsWith("/clients/") ? "Projet" : "File posts"}
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{clientName}</h1>
        <Badge
          variant={
            postGroup(post.status) === "echec" ? "destructive" : "secondary"
          }
        >
          {POST_STATUS_LABELS_FR[post.status]}
        </Badge>
      </div>

      {post.publishError && (
        <Alert variant="destructive">
          <AlertDescription>
            Échec de publication : {post.publishError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Formulaire */}
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="summary">Texte du post</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              onKeyDown={(event) => {
                // Même geste que la file reviews : ⌘↵ envoie l'action
                // principale (approuver si possible, sinon enregistrer).
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  if (busy || readOnly) return;
                  if (isPostApprovable(post.status)) approve();
                  else save();
                }
              }}
              rows={10}
              maxLength={MAX_SUMMARY_LENGTH}
              disabled={readOnly}
            />
            <span className="self-end text-xs tabular-nums text-muted-foreground">
              {summary.length}/{MAX_SUMMARY_LENGTH}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Bouton (CTA)</Label>
              <Select
                value={ctaType}
                onValueChange={(value) => setCtaType(value as CtaType | "none")}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  <SelectItem value="LEARN_MORE">En savoir plus</SelectItem>
                  <SelectItem value="CALL">Appeler</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ctaType === "LEARN_MORE" && (
              <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                <Label htmlFor="cta-url">URL du bouton</Label>
                <Input
                  id="cta-url"
                  type="url"
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  placeholder="https://…"
                  disabled={readOnly}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduled-for">Publication prévue</Label>
              <Input
                id="scheduled-for"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Image */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-3">
            <div className="flex items-center justify-between">
              <Label>Image du post</Label>
              <span
                className={cn(
                  "text-xs",
                  post.imageUrl ? "text-success" : "text-warning",
                )}
              >
                {post.imageUrl ? "Image en place" : "À choisir"}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1.5 rounded-md border border-border bg-background p-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={regenerateImage}
                  disabled={busy || readOnly}
                  className="justify-center"
                >
                  <Sparkles />
                  {imageBusy
                    ? "Génération…"
                    : post.imageUrl
                      ? "Générer une autre image"
                      : "Générer une image IA"}
                </Button>
                <Input
                  value={imageDirective}
                  onChange={(event) => setImageDirective(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !busy && !readOnly) {
                      event.preventDefault();
                      regenerateImage();
                    }
                  }}
                  aria-label="Directive pour la génération d'image"
                  placeholder="Directive : « plus lumineux », « en hiver »…"
                  className="h-7 text-xs"
                  disabled={readOnly}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 rounded-md border border-border bg-background p-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || readOnly}
                  className="justify-center"
                >
                  <Upload />
                  Choisir un fichier…
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  JPEG, PNG ou WebP — recadrée en 1200×900.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadImage(file);
                  event.target.value = "";
                }}
              />
            </div>
            {!post.imageUrl && (
              <p className="text-xs text-muted-foreground">
                Le post peut partir sans image, mais un post avec image
                performe nettement mieux sur Google.
              </p>
            )}
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {isPostApprovable(post.status) && (
                  <Button size="sm" onClick={approve} disabled={busy}>
                    {approving ? "…" : "Approuver et planifier"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={
                    post.status === "scheduled" ? "default" : "secondary"
                  }
                  onClick={() => {
                    const problem = validate();
                    if (problem) toast.error(problem);
                    else setConfirmPublish(true);
                  }}
                  disabled={busy}
                >
                  {publishing ? "Publication…" : "Publier maintenant"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => save()}
                  disabled={busy}
                >
                  {saving ? "Enregistrement…" : "Enregistrer sans approuver"}
                </Button>
              </div>
              {isPostApprovable(post.status) && (
                <p className="text-xs text-muted-foreground">
                  Approuver = le post part tout seul à la date « Publication
                  prévue ». Rien d&apos;autre à faire.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Préviz Google temps réel */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Aperçu Google
          </span>
          <PostPreview
            clientName={clientName}
            summary={summary}
            imageUrl={post.imageUrl}
            ctaType={ctaType === "none" ? null : ctaType}
          />
        </div>
      </div>

      {/* La publication immédiate est irréversible et publique : confirm. */}
      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publier immédiatement ?</DialogTitle>
            <DialogDescription>
              Le post part tout de suite sur la fiche Google de {clientName},
              sans attendre la date prévue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmPublish(false)}
            >
              Annuler
            </Button>
            <Button size="sm" onClick={publishNow}>
              Publier sur Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
