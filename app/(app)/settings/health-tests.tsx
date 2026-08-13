"use client";

// Boutons de vérification des deux canaux sortants. Un canal d'alerte
// ne se « vérifie » pas en lisant la config : Resend refuse tout
// destinataire hors compte tant qu'aucun domaine n'est vérifié, et un
// DSN Sentry valide n'implique pas que l'événement arrive. On envoie
// pour de vrai et on affiche la réponse du fournisseur.

import { useState, useTransition } from "react";
import { BellRing, Bug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTestAlertAction, sendTestSentryAction } from "./actions";

type Outcome = { ok: boolean; message: string } | null;

export function HealthTests() {
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<Outcome>(null);
  const [sentry, setSentry] = useState<Outcome>(null);

  function testAlert() {
    setAlert(null);
    startTransition(async () => {
      const result = await sendTestAlertAction();
      if (!result.ok) {
        setAlert({ ok: false, message: result.error });
        return;
      }
      const failed = (result.results ?? []).filter((r) => !r.ok);
      setAlert(
        failed.length
          ? {
              ok: false,
              message: failed
                .map((r) => `${r.channel} : ${r.error ?? "échec"}`)
                .join(" · "),
            }
          : {
              ok: true,
              message: `Envoyé (${(result.results ?? [])
                .map((r) => r.channel)
                .join(", ")}) — vérifie ta boîte de réception.`,
            },
      );
    });
  }

  function testSentry() {
    setSentry(null);
    startTransition(async () => {
      const result = await sendTestSentryAction();
      setSentry(
        result.ok
          ? {
              ok: true,
              message: `Événement ${result.eventId?.slice(0, 8)} envoyé — il doit apparaître dans Sentry en moins d'une minute.`,
            }
          : { ok: false, message: result.error },
      );
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={testAlert} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <BellRing />}
          Tester les alertes
        </Button>
        <Button size="sm" variant="outline" onClick={testSentry} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Bug />}
          Tester Sentry
        </Button>
      </div>
      {alert && <Outcome outcome={alert} />}
      {sentry && <Outcome outcome={sentry} />}
    </div>
  );
}

function Outcome({ outcome }: { outcome: NonNullable<Outcome> }) {
  return (
    <p
      className={`text-sm ${outcome.ok ? "text-success" : "text-destructive"}`}
    >
      {outcome.message}
    </p>
  );
}
