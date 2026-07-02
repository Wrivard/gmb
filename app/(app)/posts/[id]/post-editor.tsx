"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { CtaType, PostStatus } from "@/lib/types/database";
import {
  approvePostAction,
  publishPostNowAction,
  regeneratePostImageAction,
  updatePostAction,
  uploadPostImageAction,
} from "../actions";

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
}: {
  post: EditorPost;
  clientName: string;
  clientWebsite: string | null;
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
  const [saving, startSave] = useTransition();
  const [approving, startApprove] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [imageBusy, startImage] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = saving || approving || publishing || imageBusy;
  const readOnly = post.status === "published" || post.status === "publishing";

  function save(then?: () => void) {
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
    save(() =>
      startApprove(async () => {
        const result = await approvePostAction(post.id);
        if (result.ok) {
          toast.success("Post approuvé et planifié.");
          router.push("/posts");
        } else {
          toast.error(result.error);
        }
      }),
    );
  }

  function publishNow() {
    save(() =>
      startPublish(async () => {
        const result = await publishPostNowAction(post.id);
        if (result.ok) {
          toast.success("Post publié.");
          router.push("/posts");
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
        <Button variant="ghost" size="sm" render={<Link href="/posts" />}>
          <ArrowLeft />
          Posts
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{clientName}</h1>
        <Badge variant={post.status === "failed" ? "destructive" : "secondary"}>
          {post.status}
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
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-elevated p-3">
            <Label>Image du post</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={regenerateImage}
                disabled={busy || readOnly}
              >
                <Sparkles />
                {imageBusy ? "Génération…" : "Régénérer l'image"}
              </Button>
              <Input
                value={imageDirective}
                onChange={(event) => setImageDirective(event.target.value)}
                placeholder="Directive (optionnel) : « plus lumineux », « en hiver »…"
                className="h-7 w-72 text-xs"
                disabled={readOnly}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || readOnly}
              >
                <Upload />
                Téléverser
              </Button>
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
                Pas encore d&apos;image — le post peut partir sans, mais
                l&apos;objectif est toujours avec image.
              </p>
            )}
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => save()} disabled={busy}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              {(post.status === "draft" || post.status === "failed") && (
                <Button size="sm" onClick={approve} disabled={busy}>
                  {approving ? "…" : "Approuver et planifier"}
                </Button>
              )}
              <Button
                size="sm"
                variant={post.status === "scheduled" ? "default" : "secondary"}
                onClick={publishNow}
                disabled={busy}
              >
                {publishing ? "Publication…" : "Publier maintenant"}
              </Button>
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
    </div>
  );
}
