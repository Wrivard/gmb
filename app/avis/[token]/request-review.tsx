"use client";

// Le flux de terrain : (prénom optionnel) → « Envoyer la demande par
// texto » → l'app Messages s'ouvre avec le texte prêt, le contracteur
// choisit le contact et envoie. Deux taps. Tout se passe dans le
// navigateur — aucun appel serveur.

import { useMemo, useState } from "react";
import { ClipboardCopy, ExternalLink, MessageSquareText, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isIos, renderReviewMessage, smsHref } from "@/lib/reviews/kit";

export function RequestReview({
  businessName,
  reviewLink,
  messageTemplate,
}: {
  businessName: string;
  reviewLink: string | null;
  messageTemplate: string | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [copied, setCopied] = useState(false);

  const message = useMemo(
    () =>
      renderReviewMessage(
        { review_link: reviewLink ?? "", message: messageTemplate ?? "" },
        { businessName, firstName },
      ),
    [businessName, reviewLink, messageTemplate, firstName],
  );

  function sendSms() {
    window.location.href = smsHref(
      message,
      isIos(navigator.userAgent, navigator.maxTouchPoints),
    );
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Contexte non sécurisé ou permission refusée — l'aperçu reste
      // sélectionnable à la main.
    }
  }

  if (!reviewLink) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-5 text-center">
        <p className="text-base font-semibold">{businessName}</p>
        <p className="text-sm text-muted-foreground">
          Le lien d&apos;avis Google n&apos;est pas encore configuré pour
          cette page — contacte ton équipe Küa, ce sera réglé en deux
          minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Star className="size-5 text-primary" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          {businessName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Fin de chantier ? Demande un avis pendant que c&apos;est frais —
          ton client reçoit ton texto avec le lien direct.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rk-firstname">
          Prénom ou nom du client{" "}
          <span className="font-normal text-muted-foreground">
            (optionnel — personnalise le texto)
          </span>
        </Label>
        <Input
          id="rk-firstname"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Mme Bouchard"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          className="h-11"
        />
      </div>

      <Button size="lg" className="h-12 text-base" onClick={sendSms}>
        <MessageSquareText />
        Envoyer la demande par texto
      </Button>

      {/* Aperçu : le gars voit exactement ce qui va partir. */}
      <div className="rounded-lg border border-border bg-elevated p-4">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Le message
        </p>
        <p className="text-sm whitespace-pre-line">{message}</p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={copyMessage}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ClipboardCopy className="size-3.5" />
          {copied ? "Copié ✓" : "Copier le message"}
        </button>
        <a
          href={reviewLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          Voir la page d&apos;avis
        </a>
      </div>
    </div>
  );
}
