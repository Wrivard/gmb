"use client";

// Kit d'avis — le panneau de config côté Küa (onglet Réglages) :
// le lien de la page terrain du contracteur, le lien d'avis Google,
// le gabarit du texto et les QR à imprimer. La page publique vit à
// /avis/<token> (app/avis/[token]).

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ClipboardCopy, Download, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultReviewMessage } from "@/lib/reviews/kit";
import type { ReviewKitData } from "@/lib/types/database";
import { updateReviewKitAction } from "./actions";

export function ReviewKitCard({
  clientId,
  clientName,
  token,
  kit,
}: {
  clientId: string;
  clientName: string;
  token: string;
  kit: ReviewKitData;
}) {
  const router = useRouter();
  const [reviewLink, setReviewLink] = useState(kit.review_link ?? "");
  const [message, setMessage] = useState(kit.message ?? "");
  const [saving, startSave] = useTransition();

  // L'URL publique dépend de l'hôte courant — connu côté navigateur.
  const [pageUrl, setPageUrl] = useState("");
  useEffect(() => {
    setPageUrl(`${window.location.origin}/avis/${token}`);
  }, [token]);

  const dirty =
    reviewLink.trim() !== (kit.review_link ?? "") ||
    message.trim() !== (kit.message ?? "");

  function save() {
    startSave(async () => {
      const result = await updateReviewKitAction(clientId, {
        review_link: reviewLink,
        message,
      });
      if (result.ok) {
        toast.success("Kit d'avis enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function copyPageUrl() {
    await navigator.clipboard.writeText(pageUrl);
    toast.success("Lien de la page copié — envoie-le au client.");
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium">Kit d&apos;avis</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          La page terrain du client : deux taps et le texto de demande
          d&apos;avis part de SON téléphone. À mettre en favori sur son
          écran d&apos;accueil (ou via le QR dans le camion).
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4">
        <div className="flex flex-col gap-1.5">
          <Label>Page « Demander un avis »</Label>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
              {pageUrl || "…"}
            </code>
            <Button size="sm" variant="outline" onClick={copyPageUrl}>
              <ClipboardCopy />
              Copier
            </Button>
            <Button
              size="sm"
              variant="ghost"
              render={
                <a href={pageUrl || "#"} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink />
              Ouvrir
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rk-link">Lien d&apos;avis Google</Label>
          <Input
            id="rk-link"
            type="url"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            placeholder="https://g.page/r/…/review"
          />
          <p className="text-xs text-muted-foreground">
            Depuis la fiche : « Demander des avis » → copier le lien. Sans
            lui, la page terrain reste en attente.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rk-message">Gabarit du texto</Label>
          <Textarea
            id="rk-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={defaultReviewMessage()}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {"Placeholders : {prenom} (saisi sur la page), {entreprise}, {lien}. Vide = gabarit par défaut."}
          </p>
        </div>

        <div className="flex items-center justify-end">
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {kit.review_link && (
          <QrTile
            value={kit.review_link}
            title="QR — lien d'avis"
            hint="À imprimer : factures, cartes, camion."
            filename={`qr-avis-${slugify(clientName)}.png`}
          />
        )}
        {pageUrl && (
          <QrTile
            value={pageUrl}
            title="QR — page du client"
            hint="Il le scanne une fois, l'ajoute à son écran d'accueil."
            filename={`qr-page-avis-${slugify(clientName)}.png`}
          />
        )}
      </div>
    </section>
  );
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function QrTile({
  value,
  title,
  hint,
  filename,
}: {
  value: string;
  title: string;
  hint: string;
  filename: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    void QRCode.toDataURL(value, { width: 512, margin: 2 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-elevated p-3">
      {/* Data URL — next/image ne s'applique pas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={title}
        className="size-20 rounded bg-white p-1"
      />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-44 text-xs text-muted-foreground">{hint}</p>
        <a
          href={dataUrl}
          download={filename}
          className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          <Download className="size-3" />
          Télécharger PNG
        </a>
      </div>
    </div>
  );
}
